jest.mock("vscode", () => ({
	window: {
		createTextEditorDecorationType: jest.fn().mockReturnValue({
			dispose: jest.fn(),
		}),
	},
}))
