# Orçamento Familiar

Dashboard visual do orçamento da família, alimentado por uma planilha do Google Sheets.

Você continua preenchendo a planilha. O dashboard lê os dados sempre que é aberto.

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
| `dashboard/index.html` | A página do dashboard (visual e cálculos) |
| `dashboard/leitor-da-planilha.js` | Lê a planilha e organiza os dados em linhas |
| `dashboard/fonte-de-dados.json` | Diz de qual planilha os dados vêm |

## Onde ele roda

O dashboard está publicado como um Artifact no Claude. Este repositório guarda o código como backup e para evoluir o projeto.

## Formato da planilha

A aba "Orçamento Mensal" precisa manter esta estrutura: os totais no topo e os blocos Receitas, Despesa Fixa, Despesa Variável e Reserva / Investimento, cada um com as colunas Categoria, Previsto, Realizado e Diferença. Pode adicionar linhas dentro de cada bloco.

Os dados da planilha não ficam neste repositório.
