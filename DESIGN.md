# World of Dreams — Design System (Normativo)

> Documento normativo do design system do ecossistema **World of Dreams**
> (https://shop.worldofdreams.pt). Este ficheiro é a fonte de verdade da
> identidade visual da loja e aplica-se ao tema `Extendable` (block theme
> WordPress + WooCommerce). Qualquer alteração de UI, CSS ou templates **deve**
> respeitar as regras aqui definidas. Em caso de conflito com estilos legados,
> prevalece este documento.

---

## 1. Identidade & princípios

| Campo       | Valor                                              |
|-------------|----------------------------------------------------|
| Nome        | World of Dreams Store                              |
| Estilo      | Dark Glassmorphism                                 |
| Língua      | pt-PT                                              |
| Tema base   | Extendable (derivado de Twenty Twenty-Two)         |
| Plataforma  | WordPress 6.x + WooCommerce (block themes)         |
| Escala      | Mobile-first (390 → 768 → 1440 px)                 |

Princípios:

1. **Escuro primeiro.** O fundo é sempre escuro (`#09090b`); nunca usar fundos
   brancos em superfícies de conteúdo.
2. **Vidro sobre escuro.** Cartões e painéis usam fundo translúcido +
   `backdrop-filter: blur(20px)` + borda subtil.
3. **Ouro para ação.** O dourado é reservado a preços, CTAs primários de
   compra/checkout e estados de foco/seleção.
4. **Nunca transbordar.** `document.documentElement.scrollWidth === window.innerWidth`
   em todos os viewports. Proibido scroll horizontal.
5. **Compacto em mobile.** Cabeçalho ≤ 64px, cartões compactos, drawer a largura total.

---

## 2. Paleta de cores

### 2.1 Cores base (canónicas)

| Token                | Valor                               | Uso                                            |
|----------------------|-------------------------------------|------------------------------------------------|
| `--bg-base`          | `#09090b`                           | Fundo da página / documento                    |
| `--bg-card`          | `rgba(10, 10, 14, 0.94)`            | Fundo de cartões (glass)                       |
| `--glass-blur`       | `blur(20px)`                        | `backdrop-filter` de cartões/cabeçalho/panéis  |
| `--glass-border`     | `rgba(255, 255, 255, 0.12)`         | Borda dos cartões/panéis                       |
| `--glass-highlight`  | `rgba(255, 255, 255, 0.35)`         | Borda superior (highlight) dos cartões         |
| `--accent-gold`      | `#d4af37`                           | Destaque: preços, CTAs, foco/seleção           |
| `--accent-gold-text` | `#000000`                           | Texto sobre fundo dourado                      |
| `--text-primary`     | `#ffffff` / `#f1f5f9`               | Títulos e texto principal                      |
| `--text-secondary`   | `#94a3b8` / `rgba(255,255,255,0.65)`| Texto secundário / legendas                    |

### 2.2 Destaque dourado

- Cor de destaque: **`#d4af37`** (ouro).
- Botões primários de **checkout/compra**: fundo `#d4af37`, texto **`#000000`**,
  `font-weight: 700–900`, `text-transform: uppercase`.
- Hover: `#f5c518` (clarear), mantendo texto preto.

> **Migração (legado):** os valores antigos `#fcd34d`, `#fde047` e `#ffe066`
> ainda existem em `style.css` e devem convergir para `#d4af37` (hover `#f5c518`).
> Não introduzir novos usos dos valores legados.

---

## 3. Regra fundamental anti-overflow

Em **todos** os viewports (mobile, tablet, desktop):

```js
document.documentElement.scrollWidth === window.innerWidth
```

Ou seja, **não pode existir scroll horizontal**. Regras de implementação:

- `html, body { overflow-x: hidden; max-width: 100vw; }` (já aplicado em `style.css`).
- `box-sizing: border-box` em todos os componentes de layout.
- Inputs, selects e tabelas: `max-width: 100%`.
- Carrosséis usam `overflow-x: auto` **interno** (scroll contido, sem alargar o documento).
- O Cart Drawer usa `position: fixed` + `overscroll-behavior: contain` — nunca pode
  criar scroll horizontal no `body`.

Verificação automatizada: `audit-store.js` (ver §7).

---

## 4. Componentes

### 4.1 Cabeçalho (Header)

- Glass escuro: fundo `rgba(9, 9, 11, 0.85)` + `backdrop-filter: blur(20px)` +
  borda inferior `rgba(255, 255, 255, 0.12)`.
- **Mobile: altura contida, `max-height: 64px`**, padding `8px 12px`, título
  truncado (`white-space: nowrap`).
- Sticky: `position: sticky; top: 0; z-index: 999999`.
- Menu mobile: overlay a `100vw × 100vh`, fundo `rgba(7, 9, 15, 0.98)`, itens em
  coluna e fecho (✕) visível no canto superior direito.

### 4.2 Cartões de produto

- **Compactos**: largura base `280px` (carrossel), `flex: 0 0 280px`.
- **Imagens 1:1**, `aspect-ratio: 1/1`, `max-height: 220px`, `object-fit: contain`.
- Glass: fundo translúcido + blur + borda `rgba(255, 255, 255, 0.12)`.
- Título limitado a 2 linhas (`-webkit-line-clamp: 2`); preço em dourado.

### 4.3 Cart Drawer (Mini-Cart)

- **Mobile: `100vw`** (largura total).
- **Desktop: `440px`** (`max-width: 100%`).
- Botão de checkout: `#d4af37` / texto `#000000`.
- Abre via AJAX ao submeter o formulário do produto (ver `assets/js/wod-add-to-cart.js`).

### 4.4 Botões primários (checkout/compra)

- Fundo `#d4af37`, texto `#000000`, `border-radius: 8px`,
  `text-transform: uppercase`, `letter-spacing: 0.05em`.

---

## 5. Escala responsiva (mobile-first)

| Breakpoint | Viewport de teste | Comportamento                                               |
|------------|-------------------|-------------------------------------------------------------|
| Mobile     | 390 × 844         | Cabeçalho ≤ 64px, cartões 280px, drawer `100vw`             |
| Tablet     | 768 × 1024        | Cartões ~240px no carrossel, colunas empilham se necessário |
| Desktop    | 1440 × 900        | Cartões 280px, drawer `440px`, painéis até `1200px`         |

---

## 6. Acessibilidade & interações

- Contraste: texto claro sobre escuro; texto preto sobre dourado.
- Estados de foco: outline visível + halo dourado (`box-shadow`).
- Seleção de texto: fundo dourado, texto preto.
- `prefers-reduced-motion`: respeitar (animações desativáveis).

---

## 7. Auditoria automatizada

O design system é validado por `audit-store.js` (Node.js + Puppeteer), que:

- Percorre Home, Catálogo, Ficha de Produto e Checkout.
- Testa Mobile (390), Tablet (768) e Desktop (1440).
- Assere `document.documentElement.scrollWidth === window.innerWidth` (e
  `document.body.scrollWidth <= window.innerWidth`).
- Verifica abertura/fecho do menu mobile e abertura do Cart Drawer por AJAX.
- Guarda capturas de ecrã em `tests/screenshots/` e um relatório JSON em
  `tests/audit-report.json`.

Executar:

```bash
node audit-store.js
```

