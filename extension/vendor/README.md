# Text Fragment generator

Source: https://github.com/GoogleChromeLabs/text-fragments-polyfill
Package: `text-fragments-polyfill@6.3.0`, Apache-2.0, Copyright 2020 Google LLC.

`text-fragments.js` is the published `dist/fragment-generation-utils.js`, wrapped
in an IIFE. Its ES module export statement is replaced with a single isolated-world
namespace exposing `generateFragment`. No generation logic was changed. Repeated
injection does not redeclare global lexical bindings. The generator runs only when
the highlight menu action is invoked; no remote code is loaded at runtime.

Package archive: https://registry.npmjs.org/text-fragments-polyfill/-/text-fragments-polyfill-6.3.0.tgz
Verified archive integrity (SHA-512, base64):
`aQNC0vTgWHaBkdlhqgC6tYkZrWp9h6Y0hn02cR5mc9qN/LNtRCOslAgbZQ3TtCgOa76TNMPe9bgnLmtIzAWLfw==`
