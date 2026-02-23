package me.dralle.shop.util;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.model.ShopItem;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public final class PriceFormulaUtil {

    private static final Map<String, CompiledExpression> COMPILED_CACHE = new ConcurrentHashMap<>();
    private static final Set<String> INVALID_EXPRESSIONS = ConcurrentHashMap.newKeySet();

    private PriceFormulaUtil() {}

    public static double resolveBuyBasePrice(ShopPlugin plugin, ShopItem item) {
        if (item == null) return 0D;
        int globalCount = plugin.getStateRepository().getGlobalCount(item.getUniqueKey());
        double base = item.getPrice();
        double dynamicPrice = base;
        if (item.isDynamicPricing()) {
            dynamicPrice = base + (globalCount * item.getPriceChange());
            if (item.getMinPrice() > 0 && dynamicPrice < item.getMinPrice()) dynamicPrice = item.getMinPrice();
            if (item.getMaxPrice() > 0 && dynamicPrice > item.getMaxPrice()) dynamicPrice = item.getMaxPrice();
        }

        String formula = item.getBuyPriceFormula();
        if (formula == null || formula.trim().isEmpty()) return dynamicPrice;

        Map<String, Double> vars = buildVars(item, base, dynamicPrice, globalCount);
        Double evaluated = evaluateFormula(formula, vars);
        if (evaluated == null || Double.isNaN(evaluated) || Double.isInfinite(evaluated)) {
            return dynamicPrice;
        }
        return evaluated;
    }

    public static double resolveSellBasePrice(ShopPlugin plugin, ShopItem item) {
        if (item == null || item.getSellPrice() == null) return 0D;
        int globalCount = plugin.getStateRepository().getGlobalCount(item.getUniqueKey());
        double base = item.getSellPrice();
        double dynamicPrice = base;
        if (item.isDynamicPricing()) {
            dynamicPrice = base + (globalCount * item.getPriceChange());
            if (item.getMinPrice() > 0 && dynamicPrice < item.getMinPrice()) dynamicPrice = item.getMinPrice();
            if (item.getMaxPrice() > 0 && dynamicPrice > item.getMaxPrice()) dynamicPrice = item.getMaxPrice();
            if (dynamicPrice < 0.01D) dynamicPrice = 0.01D;
        }

        String formula = item.getSellPriceFormula();
        if (formula == null || formula.trim().isEmpty()) return dynamicPrice;

        Map<String, Double> vars = buildVars(item, base, dynamicPrice, globalCount);
        Double evaluated = evaluateFormula(formula, vars);
        if (evaluated == null || Double.isNaN(evaluated) || Double.isInfinite(evaluated)) {
            return dynamicPrice;
        }
        return Math.max(0.01D, evaluated);
    }

    private static Map<String, Double> buildVars(ShopItem item, double base, double dynamicPrice, int globalCount) {
        Map<String, Double> vars = new HashMap<>();
        vars.put("base", base);
        vars.put("price", base);
        vars.put("dynamic", dynamicPrice);
        vars.put("dynamic_price", dynamicPrice);
        vars.put("global_count", (double) globalCount);
        vars.put("count", (double) globalCount);
        vars.put("amount", (double) Math.max(1, item.getAmount()));
        vars.put("price_change", item.getPriceChange());
        vars.put("min_price", item.getMinPrice());
        vars.put("max_price", item.getMaxPrice());
        vars.put("limit", (double) item.getLimit());
        vars.put("global_limit", (double) item.getGlobalLimit());
        return vars;
    }

    public static Double evaluateFormula(String expression, Map<String, Double> vars) {
        if (expression == null || expression.trim().isEmpty()) return null;
        String normalized = expression.trim();
        if (INVALID_EXPRESSIONS.contains(normalized)) return null;
        try {
            CompiledExpression compiled = COMPILED_CACHE.get(normalized);
            if (compiled == null) {
                compiled = Parser.compile(normalized);
                COMPILED_CACHE.put(normalized, compiled);
            }
            double out = compiled.evaluate(vars);
            return out;
        } catch (Exception ex) {
            INVALID_EXPRESSIONS.add(normalized);
            return null;
        }
    }

    @FunctionalInterface
    private interface CompiledExpression {
        double evaluate(Map<String, Double> vars);
    }

    private static final class Parser {
        private final String s;
        private int pos = 0;

        private Parser(String s) {
            this.s = s;
        }

        private static CompiledExpression compile(String expression) {
            Parser parser = new Parser(expression);
            CompiledExpression out = parser.parseExpr();
            parser.skipWs();
            if (parser.pos < parser.s.length()) {
                throw new IllegalStateException("Unexpected token at " + parser.pos);
            }
            return out;
        }

        private CompiledExpression parseExpr() {
            CompiledExpression v = parseTerm();
            while (true) {
                skipWs();
                if (match('+')) {
                    CompiledExpression left = v;
                    CompiledExpression right = parseTerm();
                    v = vars -> left.evaluate(vars) + right.evaluate(vars);
                } else if (match('-')) {
                    CompiledExpression left = v;
                    CompiledExpression right = parseTerm();
                    v = vars -> left.evaluate(vars) - right.evaluate(vars);
                }
                else break;
            }
            return v;
        }

        private CompiledExpression parseTerm() {
            CompiledExpression v = parseFactor();
            while (true) {
                skipWs();
                if (match('*')) {
                    CompiledExpression left = v;
                    CompiledExpression right = parseFactor();
                    v = vars -> left.evaluate(vars) * right.evaluate(vars);
                }
                else if (match('/')) {
                    CompiledExpression left = v;
                    CompiledExpression right = parseFactor();
                    v = vars -> {
                        double d = right.evaluate(vars);
                        if (Math.abs(d) < 1.0e-12D) return 0D;
                        return left.evaluate(vars) / d;
                    };
                } else break;
            }
            return v;
        }

        private CompiledExpression parseFactor() {
            skipWs();
            if (match('+')) return parseFactor();
            if (match('-')) {
                CompiledExpression inner = parseFactor();
                return vars -> -inner.evaluate(vars);
            }

            if (match('(')) {
                CompiledExpression v = parseExpr();
                expect(')');
                return v;
            }

            if (peekIsDigit() || peek('.') ) {
                double num = parseNumber();
                return vars -> num;
            }

            String ident = parseIdent();
            if (ident.isEmpty()) return vars -> 0D;
            skipWs();
            if (match('(')) {
                CompiledExpression a = parseExpr();
                skipWs();
                if (match(',')) {
                    CompiledExpression b = parseExpr();
                    expect(')');
                    return vars -> applyFn2(ident, a.evaluate(vars), b.evaluate(vars));
                }
                expect(')');
                return vars -> applyFn1(ident, a.evaluate(vars));
            }
            String variable = ident.toLowerCase(Locale.ROOT);
            return vars -> vars != null ? vars.getOrDefault(variable, 0D) : 0D;
        }

        private static double applyFn1(String fn, double a) {
            String k = fn.toLowerCase(Locale.ROOT);
            return switch (k) {
                case "abs" -> Math.abs(a);
                case "round" -> (double) Math.round(a);
                case "floor" -> Math.floor(a);
                case "ceil", "ceiling" -> Math.ceil(a);
                default -> 0D;
            };
        }

        private static double applyFn2(String fn, double a, double b) {
            String k = fn.toLowerCase(Locale.ROOT);
            return switch (k) {
                case "min" -> Math.min(a, b);
                case "max" -> Math.max(a, b);
                case "pow" -> Math.pow(a, b);
                default -> 0D;
            };
        }

        private void skipWs() {
            while (pos < s.length() && Character.isWhitespace(s.charAt(pos))) pos++;
        }

        private boolean match(char c) {
            skipWs();
            if (pos < s.length() && s.charAt(pos) == c) {
                pos++;
                return true;
            }
            return false;
        }

        private void expect(char c) {
            if (!match(c)) throw new IllegalStateException("Expected " + c);
        }

        private boolean peek(char c) {
            skipWs();
            return pos < s.length() && s.charAt(pos) == c;
        }

        private boolean peekIsDigit() {
            skipWs();
            return pos < s.length() && Character.isDigit(s.charAt(pos));
        }

        private double parseNumber() {
            skipWs();
            int start = pos;
            boolean dot = false;
            while (pos < s.length()) {
                char ch = s.charAt(pos);
                if (Character.isDigit(ch)) {
                    pos++;
                    continue;
                }
                if (ch == '.' && !dot) {
                    dot = true;
                    pos++;
                    continue;
                }
                break;
            }
            return Double.parseDouble(s.substring(start, pos));
        }

        private String parseIdent() {
            skipWs();
            int start = pos;
            while (pos < s.length()) {
                char ch = s.charAt(pos);
                if (Character.isLetterOrDigit(ch) || ch == '_' || ch == '.') {
                    pos++;
                } else {
                    break;
                }
            }
            return s.substring(start, pos);
        }
    }
}
