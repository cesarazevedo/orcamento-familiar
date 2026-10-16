# Orçamento Familiar

Dashboard visual do orçamento da família. O site lê a planilha do Google Sheets direto no navegador, sempre que é aberto.

Você continua preenchendo a planilha. O site acompanha.

## O que ele mostra

- Resumo do mês: receitas, despesas, saldo e taxa de economia
- Como a renda foi usada (fixas, variáveis, investimentos e o que sobra)
- Para onde vai o dinheiro, por grupo
- Maiores gastos
- Previsto e realizado
- Tabela com todos os lançamentos (busca, filtros e ordenação)

## Arquivos

| Arquivo | Para que serve |
| --- | --- |
| `index.html` | A estrutura da página |
| `style.css` | O visual (com modo escuro automático) |
| `app.js` | Lê a planilha e desenha os gráficos |

## Como funciona

O `app.js` busca a aba "Orçamento Mensal" da planilha (o código dela fica no topo do arquivo, em `SHEET_ID`). A planilha precisa estar compartilhada como "qualquer pessoa com o link pode ver".

O navegador guarda a última cópia dos dados. Se a internet falhar, o site mostra essa cópia.

## Formato da planilha

Mantenha os totais no topo e os blocos Receitas, Despesa Fixa, Despesa Variável e Reserva / Investimento, cada um com as colunas Categoria, Previsto, Realizado e Diferença. Pode adicionar linhas dentro de cada bloco.

## Atenção

O repositório é público e o site também. Quem tiver o endereço do site consegue ver os números da planilha.
