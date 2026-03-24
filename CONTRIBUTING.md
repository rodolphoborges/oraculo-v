# Oráculo V | Guia de Contribuição

Obrigado por seu interesse em contribuir com o Oráculo V! Como arquiteto do projeto, nosso foco é manter a **excelência técnica**, a **escalabilidade** e a **manutenibilidade** do código.

## 1. Padrões de Qualidade de Código

### Linting e Formatação
-   Utilizamos o **ESLint** com configuração padrão de mercado.
-   A formatação automática é feita via **Prettier**.
-   **Regra de Ouro**: O código deve ser limpo, modular e incluir comentários em JSDoc para funções críticas.

### Execução de Testes Localmente
Antes de abrir qualquer Pull Request, você deve garantir que todos os testes passem:
```bash
# Instalação de dependências
npm install

# Execução de testes ponta-a-ponta (E2E)
npm test
```

## 2. Padrão de Commits

Adoção obrigatória de **Conventional Commits**. Isso facilita a geração automática de changelogs e a rastreabilidade:

-   `feat`: Nova funcionalidade (ex: `feat: adiciona badge Clutch King`)
-   `fix`: Correção de bug (ex: `fix: trata erro de timeout na Riot API`)
-   `docs`: Alterações em documentação
-   `style`: Formatação sem alteração de lógica
-   `refactor`: Melhoria de código sem alteração funcional
-   `perf`: Melhoria de performance
-   `chore`: Manutenção de builds, dependências, etc.

## 3. Fluxo de Ramificação (Branching Model)

Adotamos o **GitHub Flow** para agilidade e integração contínua:

1.  **main**: Ramificação estável e pronta para produção. Jamais commite diretamente aqui.
2.  **Feature Branches**: Crie uma branch a partir da `main` para cada tarefa (`feature/nome-da-tarefa` ou `fix/descricao-do-bug`).
3.  **Pull Request (PR)**: Abra o PR para a `main` descrevendo o que foi alterado e como testar.
4.  **Code Review**: O PR aguardará a aprovação de pelo menos um Tech Lead antes do merge.

## 4. Submissão de Pull Request

-   Mantenha os commits organizados e atômicos.
-   Descreva as mudanças de forma técnica no corpo do PR.
-   Certifique-se de que o `.env.example` foi atualizado se novas variáveis de ambiente forem necessárias.
-   **Atenção**: Documente novos endpoints no `API.md`.
