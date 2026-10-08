# CLAUDE.md

@AGENTS.md

## Comandos
- `npm run dev` (aplica migrations e sobe o servidor), `npm test`, `npm run lint`, `npm run typecheck`, `npm run check` (os três), `npm run build`
- Schema mudou: edite `src/db/schema.ts`, rode `npx drizzle-kit generate --name <nome>` e versione o SQL de `drizzle/`.

## Convenções
- Código, nomes e commits em inglês (Conventional Commits). Interface, comentários e docs em português do Brasil.
- Dinheiro é sempre **inteiro em centavos** (`*Cents`). Margem em pontos-base (`markupBp`, 30% = 3000). Nunca use float para valores.
- Validação com zod nas bordas (Server Actions, importação). Erros de regra de negócio são classes (`BoardError`, `ImportError`, `OrderError`…) convertidas em mensagem para o usuário.
- Lógica de domínio em `src/lib/**`, testável com PGlite em memória (`createTestDb()`). Páginas e actions em `src/app/**` ficam finas.
- Etapas dos Kanbans e tipos de cliente são `text` no banco, definidos em `src/lib/kanban/stages.ts` e `src/lib/segments.ts`.

## Decisões de arquitetura
- Next.js 16 (App Router, Server Actions) + Drizzle + PostgreSQL. `cacheComponents` desligado de propósito: tudo é dinâmico e depende do usuário logado.
- Banco local e de testes é **PGlite** (`DATABASE_URL=pglite:...`); em produção, `postgres://`. Ver `src/db/client.ts`.
- Autenticação própria: scrypt e sessões no banco (só o hash do token). Perfis:
  - `staff`: área interna, todos com o mesmo acesso.
  - `customer`: só `/portal`, ligado a um `clients.id`.
- SheetJS vem do **CDN oficial** (`package.json` aponta para o tarball); a versão do npm está parada e vulnerável.
- Importação em 3 passos:
  1. Prévia e mapeamento de colunas.
  2. `extractRows` gera a revisão editável.
  3. `validateRows` + `applyImport`.

  O servidor sempre revalida o que veio da revisão. Peças que somem da planilha ficam `active=false`, nunca são apagadas.
- Virada da semana do Farmer é feita **sob demanda**, ao abrir o quadro (`rolloverFarmerWeek`), sem cron. Usa a segunda-feira no horário de Brasília.

## Armadilhas
- **Toda Server Action interna precisa chamar `requireUser()`**, que também barra logins de cliente. O portal usa `requireCustomer()`. Fazer a verificação só na página não protege a action.
- O preço exibido no portal e gravado no pedido é sempre recalculado no servidor (`placeOrder`). Nunca confie em preço vindo do navegador, e nunca mostre custo ou fornecedor no portal.
- PGlite: só um processo abre `.data/pglite` por vez. Não rode seed ou migrate com o `dev` aberto.
- O segmento atual vem de um cookie (`getCurrentSegment()`). Consultas novas de catálogo, clientes ou quadros precisam filtrar por ele.
- CSV brasileiro: o separador é detectado pelas primeiras linhas (a planilha pode ter título), e os valores são lidos como texto (`raw: true`) para "10,23" não virar 1023.
- Itens do pedido são cópias (código, descrição, custo, venda). Não os recalcule a partir de `parts`.
