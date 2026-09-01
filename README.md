# Progressão

PWA de treino de hipertrofia com foco nos pontos fracos: **costas (largura), ombro (deltoide lateral e posterior) e peito (porção superior)**.

Registro e progressão de carga. Roda offline no celular, salva as cargas localmente e sugere quando subir o peso.

## O que ele faz

- **7 treinos prontos**: Costas A (largura), Costas B (espessura), Peito A (porção superior), Peito B (volume e alongamento), Ombro (efeito 3D), Upper Weak Points (sessão combinada) e Braço.
- **Registro de cargas e reps** série a série, com a última sessão sempre visível como referência.
- **Progressão dupla automática**: quando você bate o topo da faixa de reps em todas as séries, o app avisa a carga da próxima sessão.
- **Biblioteca de substituições**: 2 a 3 alternativas por exercício, para máquina ocupada ou execução que você ainda não domina. A troca fica salva.
- **Histórico** por exercício, últimas 6 sessões.
- **Offline first**: service worker com cache do app inteiro. Depois do primeiro acesso, funciona sem internet na academia.

## Como instalar no celular

1. Abra a URL do GitHub Pages no navegador do celular.
2. **iPhone (Safari)**: botão de compartilhar, depois "Adicionar à Tela de Início".
3. **Android (Chrome)**: menu de três pontos, depois "Instalar app" ou "Adicionar à tela inicial".

O app abre em tela cheia, sem barra de navegador.

## Estrutura

```
index.html               shell do app
css/style.css            tema escuro, azul imperial e magenta
js/data.js               programa de treinos (edite aqui para mudar exercícios)
js/app.js                render, registro, progressão, substituições
manifest.webmanifest     metadados PWA
sw.js                    service worker (cache offline)
icons/                   ícones 192 e 512
```

## Editando os treinos

Todo o programa está em `js/data.js`. Cada exercício tem:

```js
{
  id: "ca1",                      // identificador único, usado no histórico
  name: "Pulldown pegada aberta pronada",
  sets: 4, repsMin: 8, repsMax: 10,
  rir: 1,                         // reps in reserve alvo
  rest: 120,                      // descanso em segundos
  inc: 5,                         // incremento de carga sugerido, em kg
  cue: "...",                     // orientação de execução
  tech: "rest-pause",             // null | "rest-pause" | "myo-reps" | "drop-set"
  alts: ["...", "..."]            // substituições
}
```

Não mude o `id` de um exercício depois de começar a registrar, porque o histórico é indexado por ele.

## Dados

Tudo fica no `localStorage` do próprio aparelho. Nada sai do celular, não existe servidor nem conta. Trocar de aparelho ou limpar os dados do navegador apaga o histórico.

## Publicação

Hospedado no GitHub Pages a partir da branch `main`, pasta raiz.

## Licença

Uso pessoal.
