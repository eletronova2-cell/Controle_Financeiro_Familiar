# 💰 Controle Financeiro Familiar

PWA de controle financeiro pessoal com ciclos de pagamento, despesas fixas e variáveis, histórico de 12 meses e exportação CSV.

## Funcionalidades

- **Dashboard mensal** — saldo, receitas e despesas do mês
- **Ciclos de pagamento** — dois ciclos configuráveis (padrão: dia 15 e dia 30)
- **Despesas fixas** — recorrentes mensais, com valor fixo ou variável, prazo opcional
- **Despesas variáveis** — lançamento rápido por data
- **Receitas fixas e avulsas** — salário, adiantamento e extras
- **Saúde financeira** — projeção do próximo mês com indicador visual
- **Histórico 12 meses** — gráfico de barras e detalhamento mensal
- **Exportação CSV** — para análise no Excel / Google Sheets
- **PWA** — instala no celular, funciona offline

## Stack

- React 18 + Vite
- vite-plugin-pwa (Workbox)
- localStorage (sem backend)
- Deploy: Vercel

## Desenvolvimento local

```bash
npm install
npm run dev
```

## Deploy no Vercel

1. Faça push para o GitHub
2. Importe o repositório no [Vercel](https://vercel.com)
3. Framework preset: **Vite**
4. Build command: `npm run build`
5. Output directory: `dist`

## Ícones PWA

Os ícones placeholder já estão incluídos. Para gerar ícones com o logo real:

```bash
pip install cairosvg pillow
python3 generate-icons.py
```

## Versão

`1.0.0` — versão inicial
