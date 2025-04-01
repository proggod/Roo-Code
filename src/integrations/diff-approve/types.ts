export type DiffBlock = {
	id: number
	type: "context" | "addition" | "deletion" | "change"
	oldStart: number
	oldLines: string[]
	newStart: number
	newLines: string[]
}

export type DiffContent = {
	file1: string
	file2: string
	blocks: DiffBlock[]
}

export type ApprovalAction = "approve" | "deny"

export interface DiffApproveMessage {
	command: string
	blockId?: number
	action?: ApprovalAction
	content?: DiffContent
	pendingBlocks?: number[]
}
