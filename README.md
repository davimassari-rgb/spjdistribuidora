# SPJ Distribuidora e Serviço

Sistema interno da SPJ, que distribui sob demanda para clientes B2B. Ela não tem estoque próprio: o "estoque" disponível é o catálogo dos fornecedores, que chega por planilha.

## O que o sistema faz

- **Segmentos**: Autopeças, Maquiagem e Alimentação, todos no mesmo login. O seletor no topo da tela separa fornecedores, catálogo, clientes e quadros por segmento.
- **Fornecedores e catálogo**
  - Importação de planilhas (.xlsx, .xls, .csv, .ods) com mapeamento de colunas, que fica salvo por fornecedor.
  - Etapa de **revisão** com todos os produtos antes de gravar, em que é possível editar ou excluir linhas.
  - Busca, visão por fornecedor, preços por volume e comparação de preços entre fornecedores.
  - Exclusão de fornecedor.
- **Clientes**: cadastro com CNPJ (inclusive o alfanumérico de 2026), histórico de interações e filtros por tipo, região e responsável.
- **Kanbans**, todos com arrastar e soltar:
  - **Comercial**: demandas e cotações.
  - **Prospecção**: hunter.
  - **Farmer**: carteira semanal. Na segunda-feira os cards voltam para "A contatar", e há um alerta para clientes há X semanas sem pedido.
  - **Pedidos**: pedidos vindos do portal.
- **Portal do cliente final**: a equipe cria o login na ficha do cliente. O cliente vê os produtos do segmento dele com preço de venda (preço do fornecedor + margem % do segmento), monta o carrinho e envia o pedido, que cai no quadro de Pedidos.

## Pré-requisitos

- Node.js 22.12 ou mais recente (recomendado: 24 LTS)
- npm 10+

Não é preciso instalar banco de dados para desenvolver. Localmente o sistema usa o **PGlite**, um PostgreSQL embutido que grava em `./.data/pglite`.

## Instalação e execução

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
npm run db:seed
```

```bash
npm run dev
```

Abra http://localhost:3000.

- `npm run db:seed` cria dados **fictícios** e dois logins de desenvolvimento. É opcional.
  - Equipe: `dev@spj.test` / `spj-dev-123`
  - Portal do cliente: `cliente@spj.test` / `cliente-dev-123`
- Sem o seed, a primeira tela é a **Configuração inicial** (`/setup`), onde você cria o primeiro acesso da equipe. Os demais usuários são cadastrados em **Usuários**.
- `npm run dev` aplica as migrations antes de subir o servidor.

> Com PGlite, só um processo pode abrir o banco por vez. Pare o `npm run dev` antes de rodar `db:seed` ou `db:migrate`.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Aplica migrations e sobe o servidor de desenvolvimento |
| `npm test` | Roda os testes (Vitest, com PostgreSQL em memória) |
| `npm run lint` | Lint e formatação (Biome) |
| `npm run lint:fix` | Corrige lint e formatação automaticamente |
| `npm run typecheck` | Checagem de tipos (TypeScript) |
| `npm run check` | Lint, tipos e testes juntos (o mesmo que o CI roda) |
| `npm run build` | Build de produção |
| `npm run db:generate` | Gera uma migration depois de alterar `src/db/schema.ts` |
| `npm run db:migrate` | Aplica as migrations pendentes |
| `npm run db:seed` | Dados fictícios para desenvolvimento |

## Planilhas reais

Coloque as planilhas dos fornecedores em `data/samples/`. Essa pasta, e qualquer `.xls`, `.xlsx` ou `.csv`, está no `.gitignore`, porque são dados comerciais e **nunca** devem ser versionados. Testes e seed usam só dados fictícios.

## Produção (sugestão: Vercel + Neon)

1. Crie um banco PostgreSQL (Neon tem plano gratuito) e copie a URL de conexão.
2. Na Vercel, importe o repositório e defina `DATABASE_URL` com a URL `postgresql://...`.
3. Antes de cada deploy, aplique as migrations, por exemplo com o build command `npm run db:migrate && npm run build`.
4. Acesse `/setup` para criar o primeiro usuário da equipe.
