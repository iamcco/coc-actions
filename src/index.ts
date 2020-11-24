import { ExtensionContext, commands, workspace } from "coc.nvim";
import { Actions } from "./actions";

export function activate(context: ExtensionContext) {
  if (!workspace.isNvim) {
    return workspace.showMessage("coc-actions only support neovim now!");
  }

  const actions = new Actions();

  context.subscriptions.push(actions);
  context.subscriptions.push(
    commands.registerCommand(
      "actions.open",
      async (mode?: string, line: string = "", col: string = "") => {
        actions.openMenu(mode, line, col);
      }
    )
  );
}
