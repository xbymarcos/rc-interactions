Config = {}

-- Framework Configuration
-- Options: 'qbcore', 'esx', 'standalone', 'auto'
Config.Framework = 'auto'

-- Debug Mode
Config.Debug = true

-- Interaction Settings
Config.InteractionDistance = 3.0
Config.UseTarget = true -- Requires qb-target or ox_target

-- Command to open the editor
Config.EditorCommand = 'interactioneditor'
Config.EditorGroup = 'admin' -- Group required to open editor

-- Runtime Dialogue (NPC)
-- If false, NPC will not play ambient speech/lipsync while talking.
Config.EnableNpcSpeech = true
