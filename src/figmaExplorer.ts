import * as vscode from 'vscode';
import { basename, dirname, join } from 'path';
import * as Figma from 'figma-js';
import config from './config';

export interface FigmaNode {
  resource: vscode.Uri;
  isDirectory: boolean;
}

export class FigmaModel {
  private nodes: Map<string, FigmaNode> = new Map<string, FigmaNode>();

  constructor() {}

  public connect(): Thenable<Figma.ClientInterface> {
    return new Promise((c) => {
      const client = Figma.Client({
        personalAccessToken: config.personalAccessToken,
      });
      c(client);
    });
  }

  public get roots(): Thenable<FigmaNode[]> {
    return this.connect().then((client) => {
      return new Promise((c) => {
        return this.connect().then((client) => {
          client.projectFiles(config.teamId).then((resp) => {
            const { files } = resp.data;
            if (!files) {
              c([]);
            }

            const figmaNodes = files.map((f) => ({
              resource: vscode.Uri.parse(`https://api.figma.com/team/${config.teamId}#${f.key}`),
              isDirectory: true,
            }));

            c(figmaNodes);
          });
        });
      });
    });
  }

  public getChildren(node: FigmaNode): Thenable<FigmaNode[]> {
    return this.connect().then((client) => {
      return new Promise((c) => {
        client.file(node.resource.fragment).then((resp) => {
          const { components } = resp.data;
          const children = Object.keys(components).map((key) => {
            return {
              resource: vscode.Uri.parse(
                'https://api.figma.com/v1/files/' +
                  node.resource.fragment +
                  '#' +
                  components[key].key
              ),
              isDirectory: false,
            };
          });
          c(children);
        });
      });
    });
  }

  public getContent(resource: vscode.Uri): Thenable<string> {
    const key = resource.path.replace('/v1/files/', '');
    return this.connect().then((client) => {
      return new Promise((c) => {
        client.file(key).then((resp) => {
          const { components } = resp.data;
          const fileContent = components[resource.fragment]
            ? toReactComponent(components[resource.fragment])
            : 'Not found';
          console.log(fileContent);
          c(fileContent);
        });
      });
    });
  }
}

function toReactComponent(component: Figma.Component): string {
  return component.name;
}

export class FigmaTreeDataProvider
  implements vscode.TreeDataProvider<FigmaNode>, vscode.TextDocumentContentProvider {
  private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
  readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

  constructor(private readonly model: FigmaModel) {}

  public refresh(): any {
    this._onDidChangeTreeData.fire();
  }

  public getTreeItem(element: FigmaNode): vscode.TreeItem {
    return {
      resourceUri: element.resource,
      collapsibleState: element.isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : void 0,
      command: element.isDirectory
        ? void 0
        : {
            command: 'figmaExplorer.openFigmaComponent',
            arguments: [element.resource],
            title: 'Open Figma Component',
          },
    };
  }

  public getChildren(element?: FigmaNode): FigmaNode[] | Thenable<FigmaNode[]> {
    return element ? this.model.getChildren(element) : this.model.roots;
  }

  public getParent(element: FigmaNode): FigmaNode {
    const parent = element.resource.with({ path: dirname(element.resource.path) });
    return parent.path !== '//' ? element : null;
  }

  public provideTextDocumentContent(
    uri: vscode.Uri,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<string> {
    return this.model.getContent(uri).then((content) => content);
  }
}

export class FigmaExplorer {
  private figmaViewer: vscode.TreeView<FigmaNode>;

  constructor(context: vscode.ExtensionContext) {
    /* Please note that login information is hardcoded only for this example purpose and recommended not to do it in general. */
    const figmaModel = new FigmaModel();
    const treeDataProvider = new FigmaTreeDataProvider(figmaModel);
    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider('figma', treeDataProvider)
    );

    this.figmaViewer = vscode.window.createTreeView('figmaExplorer', { treeDataProvider });

    vscode.commands.registerCommand('figmaExplorer.openFigmaComponent', (resource) =>
      figmaModel.getContent(resource)
    );
  }
}
