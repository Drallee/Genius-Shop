# YAML Bundle

`yaml.min.js` bundles `yaml@2.9.1` as a browser IIFE exposing `ShopYamlLibrary`.
It is served locally; the editor does not fetch a parser from a CDN.
The ISC license is in `yaml.LICENSE.txt`.

The esbuild entry exports:

```js
export { parseDocument, isMap, isSeq, isScalar, Document } from 'yaml';
```

Build that entry with esbuild using `--bundle --platform=browser --format=iife
--global-name=ShopYamlLibrary --minify`. Runtime integration lives in
`../js/yaml-editor.js`. Regression tests live in `src/test/web`.
