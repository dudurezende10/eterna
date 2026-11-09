Fontes da marca Viva Maracanã, cópia local para o app abrir sem internet (v94-ux, 09/11/2026).

- Big Shoulders Display 600, 700 e 800, subconjunto latin. Copyright The Big Shoulders Project Authors / Google Inc. SIL Open Font License 1.1.
  Origem: pacote npm `@fontsource/big-shoulders-display@5.3.0` (tarball sha256 2b1193236ad6a1e801780541347a6d1b46bd11e866098edf492a87fdccc8849c), pasta `files/`.
- Inter 400, 500, 600 e 700, subconjunto latin. Copyright 2016 The Inter Project Authors. SIL Open Font License 1.1.
  Origem: pacote npm `@fontsource/inter@5.3.0` (tarball sha256 02034af8d41dcc67ac8eab88f642e129bb8a2e8922abf30229c32725f54d8fd6), pasta `files/`.

O subconjunto latin cobre português, inglês, espanhol, francês e alemão. Total dos 7 arquivos: cerca de 140 KB.
Licença completa dos dois pacotes em `LICENSE`.

Como atualizar: numa pasta temporária fora do repositório, `npm pack @fontsource/big-shoulders-display@<versão> @fontsource/inter@<versão>`,
abrir os `.tgz` e copiar os mesmos 7 arquivos de `package/files/` para cá (mesmos nomes; o `@font-face` do index.html aponta para eles).
Nunca rodar `npm install` no repositório. Atualizar as versões e os sha256 acima.
