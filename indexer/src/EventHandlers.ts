/**
 * Central Event Handlers Registry
 * 
 * This file imports and registers all event handlers from modular handler files:
 * - handlers/fundex.handler.ts - FUNDex DEX events (only notifies for Monachad trades)
 * - handlers/match-manager.handler.ts - TradeClub protocol events
 * 
 * Add new DEX handlers here as we integrate more DEXes
 */

// Import all handler modules to register them with Envio
import "./handlers/fundex.handler.ts";
import "./handlers/match-manager.handler.ts";

// Note: Handlers are registered via side effects when imported
// Each handler file calls FUNDex.EventName.handler() or MatchManager.EventName.handler()
// which registers the handler with Envio's runtime
