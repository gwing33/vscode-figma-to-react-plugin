'use strict';

import * as vscode from 'vscode';
import { FigmaExplorer } from './figmaExplorer';

export function activate(context: vscode.ExtensionContext) {
  new FigmaExplorer(context);
}
