# APP_DARPE

Aplicativo instalável para lançar papeletas de atendimentos DARPE no sistema regional.
Segue a estrutura Node sem dependências, autenticação Supabase, identidade e instalação do APP_VISITAS_MOBILE.

## Configurar

1. Aplicar `047_darpe_atendimentos.sql` no banco do projeto principal e publicar a atualização Django.
2. Copiar `.env.example` para `.env` e preencher Supabase URL/chave pública, endereço do sistema principal e APP_ORIGIN.
3. Executar `npm test`, `npm run check` e `npm start` (Node 22 ou superior).
4. Abrir externamente no navegador padrão do Windows após confirmar resposta HTTP. Instalação PWA exige HTTPS ou ambiente local compatível.

O aplicativo não recebe a chave service_role. A API principal valida o token a cada consulta, consulta a aprovação atual e aplica as permissões DARPE e o escopo municipal/local existente. O cadastro é feito no sistema regional. Não há catálogo geral de músicos: os resultados são apenas cadastros DARPE ativos habilitados para a função.

PDFs, fotos da papeleta e exportações não integram esta primeira versão. O formulário mapeia data, horários, setor, local, município/comum responsáveis, atendente, orações, músicos, organistas, colaboradores, palavra/irmão, hinos, participação, observações e sete categorias de pedidos de oração (famílias aceita Todas).

Os registros são somente de inclusão e consulta; ficam preservados com operador/data e equipe da época. Um identificador por submissão permite repetir o envio após falha de rede sem duplicar. Dados pessoais e APIs não são armazenados pelo service worker. O formulário requer conexão para salvar.
