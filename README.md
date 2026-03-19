# ORÁCULO V

Data pipeline exaustivo para capturar o meta de Valorant do site [vstats.gg](https://www.vstats.gg/).

## Estrutura do Projeto

- `scrapers/`: Scripts de coleta (Puppeteer).
- `lib/`: Lógica compartilhada e utilitários.
- `schemas/`: Definições de banco de dados SQL.
- `.github/workflows/`: Automação semanal.

## Configuração

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Configure as variáveis de ambiente no arquivo `.env`:
   ```env
   SUPABASE_URL=seu_url_do_supabase
   SUPABASE_SERVICE_KEY=sua_chave_de_servico
   ```

3. Execute o script de banco de dados em `schemas/db_schema.sql` no seu console do Supabase.

4. Para rodar manualmente:
   ```bash
   npm start
   ```

## Automação

O projeto está configurado para rodar automaticamente toda segunda-feira via GitHub Actions, garantindo que o banco de dados histórico esteja sempre atualizado com o meta consolidado do fim de semana.
