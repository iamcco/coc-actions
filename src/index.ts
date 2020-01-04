import { ExtensionContext, commands } from "coc.nvim";
import {Actions} from "./actions";

export function activate(context: ExtensionContext) {

  const actions = new Actions()

  context.subscriptions.push(actions)
  context.subscriptions.push(
    commands.registerCommand('actions.open', async () => {
      actions.openMenu()
    })
  )
}
