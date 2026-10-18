# Jogos de Live (frutas humanoides)

5 jogos em que o chat da sua live do TikTok joga: comentário entra no jogo e presente muda a partida.

| Jogo | Arquivo | Como o chat joga |
|---|---|---|
| Chefão Coletivo | chefao.html | Comentário ataca o chefão. Presente = super golpe |
| Pipa Combate | pipa.html | Comentário solta a pipa. Presente corta as outras (e dá escudo) |
| Corrida das Frutas | corrida.html | Comentário faz correr. Presente = turbo, banana nos líderes, foguete |
| Torre Rival | torres.html | Digite 1 ou 2 (ou verde/rosa) para escolher o time. Presente derruba a torre rival |
| Escalada Maluca | escalada.html | Digite 1/"sobe" para ajudar, 2/"cai" para derrubar o abacaxi |

O endereço principal mostra um menu com os 5 jogos.

---

## A) Pelo computador

```
npm install
node server.js @seu_usuario
```

Abra http://localhost:3000/ . Para testar sem live: http://localhost:3000/?demo=1 (botões simulam comentários e presentes).

Para pôr na live: fique ao vivo, abra o jogo numa janela de navegador alta e estreita e capture essa janela no TikTok Live Studio ou OBS.

---

## B) Só pelo celular (servidor na nuvem)

O celular não roda o servidor que lê os comentários. Por isso ele fica hospedado na internet e você só abre um endereço no navegador do celular.

### 1. Colocar no ar (uma vez só)

1. Crie uma conta grátis no GitHub (github.com) e um repositório novo, vazio.
2. Envie para ele os arquivos deste pacote (a pasta `public`, `server.js`, `package.json`, `package-lock.json`, `render.yaml`, `.gitignore`).
3. Crie uma conta grátis na Render (render.com), entrando com o GitHub.
4. Na Render: **New > Blueprint**, escolha o repositório. Ela lê o `render.yaml` sozinha.
5. Quando pedir **ALLOWED_USERS**, digite o seu @ do TikTok sem o @ (assim só você usa o servidor).
6. Clique em Deploy e espere alguns minutos. A Render mostra o endereço, algo como `https://jogos-de-live-xxxx.onrender.com`.

### 2. Na hora da live

1. **Uns 2 minutos antes**, abra no navegador do celular:
   `https://SEU-ENDERECO.onrender.com/?user=seu_usuario`
   (no plano grátis o servidor dorme sem uso e leva cerca de 1 minuto para acordar). Salve nos favoritos.
2. Entre ao vivo no TikTok com a opção de transmitir a tela do celular.
3. Volte ao navegador, escolha o jogo e deixe a tela ligada. No canto da tela aparece "ao vivo: @seu_usuario" quando está lendo o seu chat.

Dica: para ir direto a um jogo, use `https://SEU-ENDERECO.onrender.com/pipa.html?user=seu_usuario` (troque `pipa` por chefao, corrida, torres ou escalada).

---

## Avisos honestos

- A leitura de comentários e presentes usa a biblioteca não oficial `tiktok-live-connector`. Ela pode parar de funcionar quando o TikTok mudar algo.
- Servidores na nuvem às vezes são bloqueados pelo TikTok. Se aparecer "aguardando live" mesmo com você ao vivo, crie uma chave grátis no Euler Stream e coloque na Render como variável `EULER_API_KEY`.
- O plano grátis da Render serve para testes e uso pessoal. Se o serviço dormir no meio da live, o plano pago (Starter, cerca de US$ 7 por mês) não dorme.
- Quem manda presente precisa ter 18 anos ou mais, e sua conta precisa ter a LIVE liberada.
- Ajuste a dificuldade pelo bloco CONFIGURAÇÃO no começo de cada arquivo .html.
