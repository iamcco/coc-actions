# coc-actions

Actions menu for coc.nvim (neovim >= v0.4.0 only)

![image](https://user-images.githubusercontent.com/5492542/71774253-78717700-2fa6-11ea-9629-1e88d0b5114e.png)

## Installation

`:CocInstall coc-actions`

**Commands**

- `:CocCommand actions.open` for current cursor position

**Mapping**

Config as coc.nvim README

``` vim
" Remap for do codeAction of selected region
function! s:cocActionsOpenFromSelected(type) abort
  execute 'CocCommand actions.open ' . a:type
endfunction
xmap <silent> <leader>a :<C-u>execute 'CocCommand actions.open ' . visualmode()<CR>
nmap <silent> <leader>a :<C-u>set operatorfunc=<SID>cocActionsOpenFromSelected<CR>g@
```

Then

- `<leader>a` for the current selected range
- `<leader>aw` for the current word
- `<leader>aas` for the current sentence
- `<leader>aap` for the current paragraph

> `:h text-objects` to see more detail

## Settings

- `coc-actions.hideCursor`: true
  > Hide cursor when open actions menu
- `coc-actions.showActionKind`: true
  > Show action kind
- `coc-actions.useCursorLine`: false
  > Using cursorline for active line, this avoids tail whitespace

### Buy Me A Coffee ☕️

![btc](https://img.shields.io/keybase/btc/iamcco.svg?style=popout-square)

![image](https://user-images.githubusercontent.com/5492542/42771079-962216b0-8958-11e8-81c0-520363ce1059.png)
