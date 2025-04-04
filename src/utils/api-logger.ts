//system prompt https://pastebin.com/raw/qxsfqJgp
//https://glama.ai/models/gemini-2.5-pro-exp-03-25

import { Anthropic } from "@anthropic-ai/sdk"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { EXPERIMENT_IDS } from "../shared/experiments"

interface ApiRequestLog {
	systemPrompt: string
	messages: Anthropic.Messages.MessageParam[]
}

interface ApiResponseLog {
	content: string
	usage?: {
		inputTokens: number
		outputTokens: number
		cacheWriteTokens?: number
		cacheReadTokens?: number
	}
}

let apiLoggingEnabled = false

export function setApiLoggingEnabled(enabled: boolean): void {
	apiLoggingEnabled = enabled
}

export function isApiLoggingEnabled(): boolean {
	return apiLoggingEnabled
}

export function resetLogFile(): void {
	if (!isApiLoggingEnabled()) return

	const homeDir = os.homedir()
	const logDir = path.join(homeDir, ".roo_logs")
	const logFile = path.join(logDir, "api_history.txt")

	// Create log directory if it doesn't exist
	if (!fs.existsSync(logDir)) {
		fs.mkdirSync(logDir, { recursive: true })
	}

	// Clear the log file by writing an empty string
	fs.writeFileSync(logFile, "")
}

export function logApiRequest(request: ApiRequestLog): void {
	if (!isApiLoggingEnabled()) return

	const homeDir = os.homedir()
	const logDir = path.join(homeDir, ".roo_logs")
	const logFile = path.join(logDir, "api_history.txt")

	// Create log directory if it doesn't exist
	if (!fs.existsSync(logDir)) {
		fs.mkdirSync(logDir, { recursive: true })
	}

	// Create header with date and time
	const now = new Date()
	const dateStr = now.toLocaleDateString()
	const timeStr = now.toLocaleTimeString()
	const header = `*** ${dateStr} ${timeStr} POST ${"*".repeat(200 - (dateStr.length + timeStr.length + 8))} ***\n`

	// Format the request data
	const logEntry = `${header}\nSystem Prompt:\n${request.systemPrompt}\n\nMessages:\n${JSON.stringify(request.messages, null, 2)}\n\n`

	// Append to log file
	fs.appendFileSync(logFile, logEntry)
}

export function logApiResponse(response: ApiResponseLog): void {
	if (!isApiLoggingEnabled()) return

	const homeDir = os.homedir()
	const logDir = path.join(homeDir, ".roo_logs")
	const logFile = path.join(logDir, "api_history.txt")

	// Create log directory if it doesn't exist
	if (!fs.existsSync(logDir)) {
		fs.mkdirSync(logDir, { recursive: true })
	}

	// Create header with date and time
	const now = new Date()
	const dateStr = now.toLocaleDateString()
	const timeStr = now.toLocaleTimeString()
	const header = `*** ${dateStr} ${timeStr} REPLY ${"*".repeat(200 - (dateStr.length + timeStr.length + 9))} ***\n`

	// Format the response data
	let logEntry = `${header}\nResponse Content:\n${response.content}\n`

	// Add usage information if available
	if (response.usage) {
		logEntry += `\nUsage:\n${JSON.stringify(response.usage, null, 2)}\n`
	}

	logEntry += "\n"

	// Append to log file
	fs.appendFileSync(logFile, logEntry)
}
