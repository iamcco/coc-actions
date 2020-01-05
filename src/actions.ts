import {Window, Buffer, Disposable, Neovim, workspace, diagnosticManager, languages, CodeAction, commands, services} from "coc.nvim"
import {CodeActionContext, ExecuteCommandParams } from "vscode-languageserver-protocol"

export class Actions implements Disposable {
  private nameSpaceFlag = 'cco-actions-line'
  private guiCursor = ''
  private subscriptions: Disposable[] = []
  private codeActions: CodeAction[] = []
  private nvim: Neovim
  private win: Window | undefined
  private buf: Buffer | undefined
  private isRegisterAutocmd: boolean = false

  constructor() {
    this.nvim = workspace.nvim
  }

  public async openMenu() {
    this.codeActions = await this.getCodeActions()
    if (!this.codeActions.length) {
      return
    }
    let width = this.codeActions.reduce((pre, cur) => {
      return pre > cur.title.length ? pre : cur.title.length
    }, 0)
    const lines = this.codeActions.map(item => ` ${item.title.padEnd(width, ' ')} `)
    width += 2
    const buf = await this.createBuf(lines)
    await this.createWin(buf, width, this.codeActions.length)
    this.addHighlight(0)
    this.registerAutocmd()
  }

  public async closeMenu() {
    if (this.win) {
      this.win.valid && this.win.close(true)
      this.win = undefined
      if (this.guiCursor) {
        this.nvim.setOption('guicursor', this.guiCursor)
        this.guiCursor = ''
      }
      if (this.buf) {
        this.buf.setOption('modifiable', true)
        this.buf.remove(0, -1)
        this.buf.setOption('modifiable', false)
      }
    }
  }

  private async createWin(buf: Buffer, width: number, height: number) {
    this.guiCursor = await this.nvim.getOption('guicursor') as string
    const win: Window = await this.nvim.openFloatWindow(buf!, true, {
      focusable: true,
      relative: 'cursor',
      anchor: 'NW',
      height,
      width,
      row: 1,
      col: 0
    })
    this.nvim.pauseNotification();
    win.setOption('relativenumber', false);
    win.setOption('number', false);
    win.setOption('wrap', false);
    win.setOption('cursorline', false);
    win.setOption('cursorcolumn', false);
    win.setOption('conceallevel', 2);
    win.setOption('signcolumn', 'no');
    win.setOption('foldcolumn', 0);
    win.setOption('winhighlight', 'Normal:Pmenu,FoldColumn:Pmenu');
    win.setOption('listchars', 'trail: ,extends: ');
    win.setCursor([1, 1])
    this.nvim.setOption('guicursor', `${this.guiCursor},a:ver1-Cursor-blinkon250-CocCursorTransparent/lCursor`)
    await this.nvim.resumeNotification();
    this.win = win
    return win
  }

  private async createBuf (lines: string[]) {
    if (!this.buf || !this.buf.valid) {
      this.buf = await this.nvim.createNewBuffer(false, true)
      await this.buf.setOption('filetype', 'cocactions')
    }
    const buf = this.buf
    await buf.setOption('modifiable', true)
    await buf.remove(0, -1)
    await buf.setLines(lines, { start: 0 })
    await buf.setOption('modifiable', false)
    return buf
  }

  private async addHighlight(line: number) {
    if (!this.win || !this.buf) {
      return
    }
    const id = await this.nvim.createNamespace(this.nameSpaceFlag)
    this.buf!.clearHighlight({
      srcId: id,
      lineStart: 0,
      lineEnd: -1
    })
    this.buf!.addHighlight({
      hlGroup: 'PmenuSel',
      line,
      colStart: 0,
      colEnd: -1,
      srcId: id
    })
  }

  private registerAutocmd() {
    if (this.isRegisterAutocmd) {
      return
    }
    this.subscriptions.push(
      workspace.registerLocalKeymap('n', '<cr>', async () => {
        const pos = await this.nvim.callFunction('getcurpos') as [number, number, number, number, number]
        const idx = pos[1] - 1
        await this.closeMenu()
        if (this.codeActions && this.codeActions[idx]) {
          setTimeout(() => {
            this.applyCodeAction(this.codeActions[idx])
          }, 100);
        }
      }, true),
      workspace.registerLocalKeymap('n', '<esc>', () => {
        this.closeMenu()
      }, true),
      workspace.registerAutocmd({
        event: 'BufLeave',
        callback: () => {
          this.closeMenu()
        }
      }),
      workspace.registerAutocmd({
        event: 'CursorMoved',
        callback: async () => {
          if (!this.win || !this.buf) {
            return
          }
          const pos = await this.nvim.callFunction('getcurpos') as [number, number, number, number, number]
          this.addHighlight(pos[1] -1)
        }
      })
    )
  }

  private async applyCodeAction(action: CodeAction) {
    let { command, edit } = action
    if (edit) await workspace.applyEdit(edit)
    if (command) {
      if (commands.has(command.command)) {
        commands.execute(command)
      } else {
        let clientId = (action as any).clientId
        let service = services.getService(clientId)
        let params: ExecuteCommandParams = {
          command: command.command,
          arguments: command.arguments
        }
        if (service.client) {
          let { client } = service
          client
            .sendRequest('workspace/executeCommand', params)
            .then(undefined, error => {
              workspace.showMessage(`Execute '${command!.command} error: ${error}'`, 'error')
            })
        }
      }
    }
  }

  private async getCodeActions () {
    const doc = await workspace.document
    if (!doc) {
      return []
    }
    const position = await workspace.getCursorPosition()
    let range = doc.getWordRangeAtPosition(position)
    if (!range) {
      let lnum = await workspace.nvim.call('line', ['.'])
      range = {
        start: { line: lnum - 1, character: 0 },
        end: { line: lnum, character: 0 }
      }
    }
    let diagnostics = diagnosticManager.getDiagnosticsInRange(doc.textDocument, range)
    let context: CodeActionContext = { diagnostics }
    let codeActionsMap = await languages.getCodeActions(doc.textDocument, range, context)
    if (!codeActionsMap) return []
    let codeActions: CodeAction[] = []
    for (let clientId of codeActionsMap.keys()) {
      let actions = codeActionsMap.get(clientId)!
        for (let action of actions) {
          codeActions.push({ clientId, ...action })
        }
    }
    codeActions.sort((a, b) => {
      if (a.isPrefered && !b.isPrefered) {
        return -1
      }
      if (b.isPrefered && !a.isPrefered) {
        return 1
      }
      return 0
    })
    return codeActions
  }

  dispose() {
    if (this.win) {
      this.win.close(true)
      this.win = undefined
    }
    if (this.buf) {
      this.buf = undefined
    }
    if (this.subscriptions.length) {
      this.subscriptions.forEach(item => {
        item.dispose()
      })
      this.subscriptions = []
    }
    this.isRegisterAutocmd = false
  }
}
