export type BridgeConfig = {
	bridge: string;
	key: string;
}
export type BridgeConfigWithId = BridgeConfig & {
	id: string;
}

export type InitArgs = { config: BridgeConfig | null }