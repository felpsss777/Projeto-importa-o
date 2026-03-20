# Roland DG Brasil Flow

MVP avançado para solicitação de compras/importação com:
- login protegido por senha
- perfis: solicitante, aprovador, importação master e TI admin
- fluxo de aprovação
- decisão final da importação
- ajuste de quantidade liberada
- painel TI para criar usuários e redefinir senhas
- visual branco, azul e cinza

## Como rodar

```bash
npm install
npm start
```

Depois abra:

```bash
http://localhost:3000
```

## Logins de teste

- TI: `ti@rolanddg.com` / `ti1234`
- Solicitante: `solicitante@rolanddg.com` / `user1234`
- Aprovador: `gestor@rolanddg.com` / `gestor1234`
- Importação: `importacao@rolanddg.com` / `import1234`

## Observação

As senhas estão protegidas com hash SHA-256 neste MVP.
