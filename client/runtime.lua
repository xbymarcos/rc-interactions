local Interactions = {}
local SpawnedEntities = {}
local ActiveZones = {}
local InteractionMemory = {}
local cam = nil
local talkLoopToken = 0
local activeTalkProjectId = nil
local activeTalkPed = nil

local SPEECH_PARAMS = "SPEECH_PARAMS_FORCE_NORMAL_CLEAR"
local SPEECH_LINES = {
    "GENERIC_HI",
    "GENERIC_HOWS_IT_GOING",
    "GENERIC_THANKS",
    "GENERIC_YES",
    "GENERIC_NO",
}

-- Initialize
CreateThread(function()
    TriggerServerEvent('rc-interactions:server:requestSync')
end)

RegisterNetEvent('rc-interactions:client:syncInteractions', function(data)
    Interactions = data
    RefreshInteractions()
end)

local function CreateInteractionCam(ped)
    if DoesCamExist(cam) then DestroyCam(cam, true) end
    
    -- Calculate position in front of ped
    local coords = GetEntityCoords(ped)
    local forward = GetEntityForwardVector(ped)
    local camPos = coords + (forward * 0.8) + vector3(0.0, 0.0, 0.65) -- 0.8m front, 0.65m up (face level approx)
    
    cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
    SetCamCoord(cam, camPos.x, camPos.y, camPos.z)
    PointCamAtPedBone(cam, ped, 31086, 0.0, 0.0, 0.0, true) -- Head bone
    SetCamActive(cam, true)
    RenderScriptCams(true, true, 1000, true, true)
end

local function DestroyInteractionCam()
    if DoesCamExist(cam) then
        RenderScriptCams(false, true, 1000, true, true)
        DestroyCam(cam, false)
        cam = nil
    end
end

local function PlayTalkAnim(ped)
    local dict = "missfbi3_party_d"
    local anim = "stand_talk_loop_a_male"
    
    RequestAnimDict(dict)
    while not HasAnimDictLoaded(dict) do Wait(10) end
    
    -- Flag 49 = Loop (1) + Upper Body (16) + Allow Rotation (32) = 49? 
    -- Flag 51 = Loop (1) + Upper Body (16) + Allow Rotation (32) + Override Physics (2)? No.
    -- Standard flags: 
    -- 1 = Loop
    -- 16 = Upper body only
    -- 48 = 16 + 32 (Upper body + Allow rotation)
    -- 49 = 1 + 16 + 32 (Loop + Upper body + Allow rotation)
    ClearPedTasks(ped)
    TaskPlayAnim(ped, dict, anim, 8.0, -8.0, -1, 1, 0, false, false, false)
end

local function StopNpcTalkLoop()
    talkLoopToken = talkLoopToken + 1

    if activeTalkPed and DoesEntityExist(activeTalkPed) then
        -- Stop mouth/voice immediately if possible
        StopCurrentPlayingSpeech(activeTalkPed)
        ClearPedTasks(activeTalkPed)
    end

    activeTalkProjectId = nil
    activeTalkPed = nil
end

local function EnsureNpcTalkLoop(projectId, ped)
    if Config and Config.EnableNpcSpeech == false then return end
    if not projectId or not DoesEntityExist(ped) then return end

    -- Avoid spawning multiple loops for the same active interaction.
    if activeTalkProjectId == projectId and activeTalkPed == ped then
        return
    end

    talkLoopToken = talkLoopToken + 1
    local myToken = talkLoopToken
    activeTalkProjectId = projectId
    activeTalkPed = ped

    CreateThread(function()
        while talkLoopToken == myToken do
            if not DoesEntityExist(ped) then
                break
            end

            -- Trigger short ambient speech lines; this usually drives lipsync automatically.
            if not IsAnySpeechPlaying(ped) then
                local line = SPEECH_LINES[math.random(1, #SPEECH_LINES)]
                PlayAmbientSpeech1(ped, line, SPEECH_PARAMS)
            end

            Wait(2200 + math.random(300, 900))
        end
    end)
end

function RefreshInteractions()
    -- Cleanup existing
    for _, entity in pairs(SpawnedEntities) do
        if DoesEntityExist(entity) then DeleteEntity(entity) end
    end
    SpawnedEntities = {}
    
    -- In a real implementation, we would remove zones/targets here too
    
    -- Create new
    for _, project in ipairs(Interactions) do
        SetupInteraction(project)
    end
end

function SetupInteraction(project)
    if not project.data or not project.data.nodes then return end
    
    local startNode = nil
    for _, node in ipairs(project.data.nodes) do
        if node.type == 'START' then
            startNode = node
            break
        end
    end
    
    if not startNode then return end
    
    -- Check if start node has coordinates (Assuming data.coords exists)
    -- If not, we can't spawn anything in the world
    if not startNode.data.coords then 
        -- print('Interaction ' .. project.name .. ' has no start coords')
        return 
    end
    
    local coords = startNode.data.coords
    local model = startNode.data.model or 'a_m_y_business_01'
    
    -- Spawn NPC logic (simplified)
    local hash = GetHashKey(model)
    RequestModel(hash)
    while not HasModelLoaded(hash) do Wait(10) end
    
    local ped = CreatePed(4, hash, coords.x, coords.y, coords.z - 1.0, coords.w or 0.0, false, true)
    FreezeEntityPosition(ped, true)
    SetEntityInvincible(ped, true)
    SetBlockingOfNonTemporaryEvents(ped, true)
    
    SpawnedEntities[project.id] = ped
    
    -- Setup Interaction (Target or TextUI)
    if Config.UseTarget then
        -- Use qb-target or ox_target
        if GetResourceState('qb-target') == 'started' then
            exports['qb-target']:AddTargetEntity(ped, {
                options = {
                    {
                        type = "client",
                        action = function()
                            StartInteraction(project)
                        end,
                        icon = "fas fa-comment",
                        label = "Talk",
                    },
                },
                distance = 2.5,
            })
        elseif GetResourceState('ox_target') == 'started' then
             exports.ox_target:addLocalEntity(ped, {
                {
                    name = 'interaction_' .. project.id,
                    icon = 'fas fa-comment',
                    label = 'Talk',
                    onSelect = function()
                        StartInteraction(project)
                    end
                }
            })
        end
    else
        -- Distance check loop (simplified, better to use a point library)
        -- For now, we skip this to keep it clean.
    end
end

function StartInteraction(project)
    -- Find Start Node
    local startNode = nil
    for _, node in ipairs(project.data.nodes) do
        if node.type == 'START' then startNode = node break end
    end
    
    if startNode then
        -- Setup Camera and Ped
        local ped = SpawnedEntities[project.id]
        if DoesEntityExist(ped) then
            CreateInteractionCam(ped)
        end

        ProcessNode(project, startNode)
    end
end

function ProcessNode(project, node)
    if not node then return end
    
    if node.type == 'START' then
        -- Find next node
        local nextNode = FindNextNode(project, node.id, 'main')
        ProcessNode(project, nextNode)
        
    elseif node.type == 'DIALOGUE' then
        -- Play Anim
        local ped = SpawnedEntities[project.id]
        if DoesEntityExist(ped) then
            PlayTalkAnim(ped)
            EnsureNpcTalkLoop(project.id, ped)
        end

        -- Show Dialogue UI
        SetNuiFocus(true, true)
        SendNUIMessage({
            action = 'showDialogue',
            data = {
                text = node.data.text,
                name = node.data.npcName,
                choices = node.data.choices,
                nodeId = node.id,
                projectId = project.id
            }
        })
        
    elseif node.type == 'END' then
        -- Stop Anim
        StopNpcTalkLoop()
        
        -- Destroy Cam
        DestroyInteractionCam()

        -- Clear interaction memory
        InteractionMemory = {}

        -- Close UI
        SetNuiFocus(false, false)
        SendNUIMessage({ action = 'closeDialogue' })
        
        -- Trigger event for external integrations
        TriggerEvent('rc-interactions:dialogueEnded', {
            projectId = project.id,
            cancelled = false
        })
        if Config.Debug then
            print('[RC-Interactions] Dialogue ended - Project: ' .. project.id .. ' | Cancelled: false')
        end
        
    elseif node.type == 'CONDITION' then
        local result = CheckCondition(node.data)
        local portId = result and 'true' or 'false'
        local nextNode = FindNextNode(project, node.id, portId)
        ProcessNode(project, nextNode)

    elseif node.type == 'SET_VARIABLE' then
        -- Store variable in memory
        if node.data.variableName then
            InteractionMemory[node.data.variableName] = node.data.variableValue or ''
            if Config.Debug then
                print('[RC-Interactions] Set variable: ' .. node.data.variableName .. ' = ' .. tostring(node.data.variableValue))
            end
        end
        -- Continue to next node
        local nextNode = FindNextNode(project, node.id, 'main')
        ProcessNode(project, nextNode)

    elseif node.type == 'EVENT' then
        -- Trigger Event
        if node.data.eventName then
            if node.data.isServer then
                TriggerServerEvent(node.data.eventName, node.data.eventPayload)
            else
                TriggerEvent(node.data.eventName, node.data.eventPayload)
            end
        end
        -- Continue
        local nextNode = FindNextNode(project, node.id, 'main')
        ProcessNode(project, nextNode)
    end
end

function CheckCondition(data)
    if not data then return false end
    
    local varType, varName = data.variableName:match("([^:]+):(.+)")
    if not varType then 
        -- Fallback: check InteractionMemory for simple variables (set by SET_VARIABLE nodes)
        local memValue = InteractionMemory[data.variableName] or ''
        local targetValue = data.variableValue or ''
        local op = data.conditionOperator or '=='

        local numA = tonumber(memValue)
        local numB = tonumber(targetValue)
        local isNumeric = numA ~= nil and numB ~= nil

        if op == '==' then return memValue == targetValue
        elseif op == '!=' then return memValue ~= targetValue
        elseif op == '>' then return isNumeric and numA > numB or false
        elseif op == '<' then return isNumeric and numA < numB or false
        elseif op == '>=' then return isNumeric and numA >= numB or false
        elseif op == '<=' then return isNumeric and numA <= numB or false
        end

        return false 
    end

    local currentValue = nil
    local targetValue = tonumber(data.variableValue) or data.variableValue

    if varType == 'item' then
        currentValue = Bridge.HasItem(GetPlayerServerId(PlayerId()), varName, 1) and 1 or 0
        -- HasItem returns boolean, but for comparison we might want numbers if checking count
        -- For now, let's assume HasItem checks existence. 
        -- If we want to check count, we need a Bridge.GetItemCount function.
        -- But Bridge.HasItem(source, item, count) exists.
        -- If the condition is "item:apple > 5", we need to check count.
        -- Current Bridge.HasItem returns boolean.
        -- Let's assume for now we are checking boolean existence or simple count if supported.
        
        -- Actually, let's use the Bridge.HasItem with the target value if it's a number
        if type(targetValue) == 'number' then
            return Bridge.HasItem(GetPlayerServerId(PlayerId()), varName, targetValue)
        else
            return Bridge.HasItem(GetPlayerServerId(PlayerId()), varName, 1)
        end

    elseif varType == 'money' then
        currentValue = Bridge.GetMoney(GetPlayerServerId(PlayerId()), varName)
        local op = data.conditionOperator or '=='
        local numCurrent = tonumber(currentValue) or 0
        local numTarget = tonumber(targetValue) or 0

        if op == '==' then return numCurrent == numTarget
        elseif op == '!=' then return numCurrent ~= numTarget
        elseif op == '>' then return numCurrent > numTarget
        elseif op == '<' then return numCurrent < numTarget
        elseif op == '>=' then return numCurrent >= numTarget
        elseif op == '<=' then return numCurrent <= numTarget
        end
        return false
        
    elseif varType == 'job' then
        return Bridge.HasGroup(GetPlayerServerId(PlayerId()), varName)
    end

    return false
end

function FindNextNode(project, currentNodeId, portId)
    for _, conn in ipairs(project.data.connections) do
        if conn.fromNodeId == currentNodeId and (conn.fromPort == portId or (not portId)) then
            -- Find the target node
            for _, node in ipairs(project.data.nodes) do
                if node.id == conn.toNodeId then
                    return node
                end
            end
        end
    end
    return nil
end

-- Callback from Dialogue UI when a choice is selected
RegisterNUICallback('selectChoice', function(data, cb)
    -- data: { projectId, nodeId, choiceId }
    local project = nil
    for _, p in ipairs(Interactions) do
        if p.id == data.projectId then project = p break end
    end
    
    if project then
        -- Find the connection from this node with this choiceId
        local nextNode = FindNextNode(project, data.nodeId, data.choiceId)
        ProcessNode(project, nextNode)
    end
    cb('ok')
end)

RegisterNUICallback('cancelInteraction', function(data, cb)
    local projectId = data.projectId
    if projectId and SpawnedEntities[projectId] then
        local ped = SpawnedEntities[projectId]
        if DoesEntityExist(ped) then
            ClearPedTasks(ped)
        end
    end

    StopNpcTalkLoop()
    
    DestroyInteractionCam()

    -- Clear interaction memory
    InteractionMemory = {}

    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'closeDialogue' })
    
    -- Trigger event for external integrations
    TriggerEvent('rc-interactions:dialogueEnded', {
        projectId = projectId,
        cancelled = true
    })
    if Config.Debug then
        print('[RC-Interactions] Dialogue ended - Project: ' .. tostring(projectId) .. ' | Cancelled: true')
    end
    
    cb('ok')
end)

-- Public API: allow other scripts to start a flow by UUID without the editor
function StartInteractionById(projectId)
    if not projectId then return false end

    local project = nil
    for _, p in ipairs(Interactions) do
        if p.id == projectId then project = p break end
    end

    if not project then
        print(('^1[RC-Interactions]^7 StartInteractionById: project not found: %s'):format(tostring(projectId)))
        return false
    end

    StartInteraction(project)
    return true
end

exports('StartInteractionById', StartInteractionById)

RegisterNetEvent('rc-interactions:client:startInteractionById', function(projectId)
    StartInteractionById(projectId)
end)

-- Test helpers: expose local state for the test harness.
-- These are only used by client/tests.lua when Config.Debug is true.
function _RCI_GetMemory()      return InteractionMemory end
function _RCI_SetMemory(t)     InteractionMemory = t end
function _RCI_GetInteractions() return Interactions end
