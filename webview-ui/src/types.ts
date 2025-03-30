export type WebviewMessage = {
	command: "sendMessage" | "systemMessageAddon"
	text: string
}
