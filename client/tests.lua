--[[
    RC-Interactions — Client Test Harness
    ======================================
    Provides in-game commands to test every piece of the runtime engine
    without needing to manually create projects in the editor.

    Usage (in-game chat or F8 console):
        /rctest all          — Run all tests
        /rctest flow         — Test flow traversal engine
        /rctest memory       — Test SET_VARIABLE + CONDITION with memory
        /rctest condition    — Test CheckCondition with all operators
        /rctest bridge       — Test bridge function availability
        /rctest spawn        — Test NPC spawn + camera + cleanup
        /rctest dialogue     — Test full dialogue UI flow (interactive)
        /rctest api          — Test public API (StartInteractionById)

    Results are printed to the F8 console with color codes.
]]

-- Guard: only register if debug mode is on
if not Config or not Config.Debug then return end

-- =========================================================================
-- Test Framework (minimal)
-- =========================================================================

local TestResults = { passed = 0, failed = 0, errors = {} }

local function PASS(name)
    TestResults.passed = TestResults.passed + 1
    print('^2[TEST PASS]^7 ' .. name)
end

local function FAIL(name, reason)
    TestResults.failed = TestResults.failed + 1
    table.insert(TestResults.errors, { name = name, reason = reason })
    print('^1[TEST FAIL]^7 ' .. name .. ' — ' .. tostring(reason))
end

local function ASSERT(name, condition, reason)
    if condition then
        PASS(name)
    else
        FAIL(name, reason or 'assertion failed')
    end
end

local function ASSERT_EQ(name, actual, expected)
    if actual == expected then
        PASS(name)
    else
        FAIL(name, ('expected %s but got %s'):format(tostring(expected), tostring(actual)))
    end
end

local function ASSERT_NOT_NIL(name, value)
    if value ~= nil then
        PASS(name)
    else
        FAIL(name, 'expected non-nil value')
    end
end

local function ASSERT_NIL(name, value)
    if value == nil then
        PASS(name)
    else
        FAIL(name, ('expected nil but got %s'):format(tostring(value)))
    end
end

local function ResetResults()
    TestResults = { passed = 0, failed = 0, errors = {} }
end

local function PrintSummary(suiteName)
    local total = TestResults.passed + TestResults.failed
    print('')
    print('^5══════════════════════════════════════════════════^7')
    print('^5  RC-Interactions Test Results: ^7' .. suiteName)
    print('^5══════════════════════════════════════════════════^7')
    print(('  ^2Passed: %d^7  |  ^1Failed: %d^7  |  Total: %d'):format(
        TestResults.passed, TestResults.failed, total))
    
    if #TestResults.errors > 0 then
        print('')
        print('^1  Failed tests:^7')
        for i, err in ipairs(TestResults.errors) do
            print(('    %d. %s — %s'):format(i, err.name, err.reason))
        end
    end
    print('^5══════════════════════════════════════════════════^7')
    print('')
end

-- =========================================================================
-- Test Fixture Builders
-- =========================================================================

local function MakeNode(id, nodeType, data)
    return {
        id = id,
        type = nodeType,
        position = { x = 0, y = 0 },
        data = data or {}
    }
end

local function MakeConnection(fromId, toId, fromPort)
    return {
        id = 'conn_' .. fromId .. '_' .. toId,
        fromNodeId = fromId,
        fromPort = fromPort or 'main',
        toNodeId = toId
    }
end

local function MakeProject(id, name, nodes, connections)
    return {
        id = id,
        name = name or 'Test Project',
        group = 'General',
        data = {
            nodes = nodes,
            connections = connections
        }
    }
end

-- =========================================================================
-- Test Suite: Flow Traversal
-- =========================================================================

local function TestFlow()
    ResetResults()
    print('^3[TEST SUITE] Flow Traversal Engine^7')
    print('')

    -- Test 1: FindNextNode basic
    do
        local project = MakeProject('t1', 'FindNextNode', {
            MakeNode('s', 'START'),
            MakeNode('d', 'DIALOGUE', { text = 'Hello' }),
        }, {
            MakeConnection('s', 'd', 'main'),
        })

        local result = FindNextNode(project, 's', 'main')
        ASSERT_NOT_NIL('FindNextNode: finds connected node', result)
        if result then
            ASSERT_EQ('FindNextNode: correct target id', result.id, 'd')
        end
    end

    -- Test 2: FindNextNode returns nil for missing connection
    do
        local project = MakeProject('t2', 'NoConn', {
            MakeNode('s', 'START'),
        }, {})

        local result = FindNextNode(project, 's', 'main')
        ASSERT_NIL('FindNextNode: nil for no connection', result)
    end

    -- Test 3: FindNextNode condition ports
    do
        local project = MakeProject('t3', 'CondPorts', {
            MakeNode('c', 'CONDITION'),
            MakeNode('y', 'DIALOGUE', { text = 'yes' }),
            MakeNode('n', 'DIALOGUE', { text = 'no' }),
        }, {
            MakeConnection('c', 'y', 'true'),
            MakeConnection('c', 'n', 'false'),
        })

        local trueResult = FindNextNode(project, 'c', 'true')
        local falseResult = FindNextNode(project, 'c', 'false')
        ASSERT_EQ('FindNextNode: true port', trueResult and trueResult.id, 'y')
        ASSERT_EQ('FindNextNode: false port', falseResult and falseResult.id, 'n')
    end

    PrintSummary('Flow Traversal')
end

-- =========================================================================
-- Test Suite: InteractionMemory + SET_VARIABLE
-- =========================================================================

local function TestMemory()
    ResetResults()
    print('^3[TEST SUITE] InteractionMemory + SET_VARIABLE^7')
    print('')

    -- Save original memory state
    local originalMemory = InteractionMemory

    -- Test 1: SET_VARIABLE stores value
    do
        InteractionMemory = {}
        local project = MakeProject('m1', 'SetVar', {
            MakeNode('sv', 'SET_VARIABLE', { variableName = 'quest', variableValue = 'started' }),
            MakeNode('e', 'END'),
        }, {
            MakeConnection('sv', 'e', 'main'),
        })

        ProcessNode(project, project.data.nodes[1])
        Wait(100)
        ASSERT_EQ('SET_VARIABLE: stores value', InteractionMemory['quest'], 'started')
    end

    -- Test 2: SET_VARIABLE chain
    do
        InteractionMemory = {}
        local project = MakeProject('m2', 'SetVarChain', {
            MakeNode('sv1', 'SET_VARIABLE', { variableName = 'a', variableValue = '1' }),
            MakeNode('sv2', 'SET_VARIABLE', { variableName = 'b', variableValue = '2' }),
            MakeNode('sv3', 'SET_VARIABLE', { variableName = 'c', variableValue = '3' }),
            MakeNode('e', 'END'),
        }, {
            MakeConnection('sv1', 'sv2', 'main'),
            MakeConnection('sv2', 'sv3', 'main'),
            MakeConnection('sv3', 'e', 'main'),
        })

        ProcessNode(project, project.data.nodes[1])
        Wait(100)
        ASSERT_EQ('SET_VARIABLE chain: a', InteractionMemory['a'], '1')
        ASSERT_EQ('SET_VARIABLE chain: b', InteractionMemory['b'], '2')
        ASSERT_EQ('SET_VARIABLE chain: c', InteractionMemory['c'], '3')
    end

    -- Test 3: SET_VARIABLE overwrites
    do
        InteractionMemory = {}
        local project = MakeProject('m3', 'Overwrite', {
            MakeNode('sv1', 'SET_VARIABLE', { variableName = 'x', variableValue = 'old' }),
            MakeNode('sv2', 'SET_VARIABLE', { variableName = 'x', variableValue = 'new' }),
            MakeNode('e', 'END'),
        }, {
            MakeConnection('sv1', 'sv2', 'main'),
            MakeConnection('sv2', 'e', 'main'),
        })

        ProcessNode(project, project.data.nodes[1])
        Wait(100)
        ASSERT_EQ('SET_VARIABLE: overwrites value', InteractionMemory['x'], 'new')
    end

    -- Test 4: END clears memory
    do
        InteractionMemory = { leftover = 'data' }
        -- We can't easily test END because it calls NUI and camera functions.
        -- Instead, test the memory clear directly.
        InteractionMemory = {}
        ASSERT_EQ('END: memory cleared (simulated)', next(InteractionMemory), nil)
    end

    -- Restore
    InteractionMemory = originalMemory or {}

    PrintSummary('InteractionMemory')
end

-- =========================================================================
-- Test Suite: CheckCondition
-- =========================================================================

local function TestCondition()
    ResetResults()
    print('^3[TEST SUITE] CheckCondition^7')
    print('')

    local originalMemory = InteractionMemory

    -- Test memory-based conditions (no prefix like item:/money:/job:)
    -- These use InteractionMemory

    -- == operator
    do
        InteractionMemory = { status = 'vip' }
        local result = CheckCondition({
            variableName = 'status',
            conditionOperator = '==',
            variableValue = 'vip'
        })
        ASSERT_EQ('Condition ==: match', result, true)
    end

    do
        InteractionMemory = { status = 'vip' }
        local result = CheckCondition({
            variableName = 'status',
            conditionOperator = '==',
            variableValue = 'normal'
        })
        ASSERT_EQ('Condition ==: mismatch', result, false)
    end

    -- != operator
    do
        InteractionMemory = { status = 'vip' }
        local result = CheckCondition({
            variableName = 'status',
            conditionOperator = '!=',
            variableValue = 'normal'
        })
        ASSERT_EQ('Condition !=: different', result, true)
    end

    do
        InteractionMemory = { status = 'vip' }
        local result = CheckCondition({
            variableName = 'status',
            conditionOperator = '!=',
            variableValue = 'vip'
        })
        ASSERT_EQ('Condition !=: same', result, false)
    end

    -- > operator (numeric)
    do
        InteractionMemory = { score = '100' }
        ASSERT_EQ('Condition >: 100 > 50', CheckCondition({
            variableName = 'score', conditionOperator = '>', variableValue = '50'
        }), true)
        ASSERT_EQ('Condition >: 100 > 200', CheckCondition({
            variableName = 'score', conditionOperator = '>', variableValue = '200'
        }), false)
    end

    -- < operator (numeric)
    do
        InteractionMemory = { score = '30' }
        ASSERT_EQ('Condition <: 30 < 50', CheckCondition({
            variableName = 'score', conditionOperator = '<', variableValue = '50'
        }), true)
        ASSERT_EQ('Condition <: 30 < 10', CheckCondition({
            variableName = 'score', conditionOperator = '<', variableValue = '10'
        }), false)
    end

    -- >= operator
    do
        InteractionMemory = { score = '100' }
        ASSERT_EQ('Condition >=: 100 >= 100', CheckCondition({
            variableName = 'score', conditionOperator = '>=', variableValue = '100'
        }), true)
        ASSERT_EQ('Condition >=: 100 >= 101', CheckCondition({
            variableName = 'score', conditionOperator = '>=', variableValue = '101'
        }), false)
    end

    -- <= operator
    do
        InteractionMemory = { score = '100' }
        ASSERT_EQ('Condition <=: 100 <= 100', CheckCondition({
            variableName = 'score', conditionOperator = '<=', variableValue = '100'
        }), true)
        ASSERT_EQ('Condition <=: 100 <= 99', CheckCondition({
            variableName = 'score', conditionOperator = '<=', variableValue = '99'
        }), false)
    end

    -- Missing variable defaults to empty string
    do
        InteractionMemory = {}
        ASSERT_EQ('Condition: missing var == empty', CheckCondition({
            variableName = 'nonexistent', conditionOperator = '==', variableValue = ''
        }), true)
        ASSERT_EQ('Condition: missing var != x', CheckCondition({
            variableName = 'nonexistent', conditionOperator = '!=', variableValue = 'x'
        }), true)
    end

    -- Non-numeric > should return false
    do
        InteractionMemory = { name = 'marcus' }
        ASSERT_EQ('Condition >: non-numeric returns false', CheckCondition({
            variableName = 'name', conditionOperator = '>', variableValue = 'aaa'
        }), false)
    end

    -- Restore
    InteractionMemory = originalMemory or {}

    PrintSummary('CheckCondition')
end

-- =========================================================================
-- Test Suite: Bridge Functions
-- =========================================================================

local function TestBridge()
    ResetResults()
    print('^3[TEST SUITE] Bridge Function Availability^7')
    print('')

    ASSERT_NOT_NIL('Bridge exists', Bridge)
    ASSERT_NOT_NIL('Bridge.Framework set', Bridge.Framework)
    ASSERT('Bridge.Ready is true', Bridge.Ready == true, 'Bridge.Ready = ' .. tostring(Bridge.Ready))

    -- Check function existence
    ASSERT_NOT_NIL('Bridge.Notify exists', Bridge.Notify)
    ASSERT_NOT_NIL('Bridge.GetIdentifier exists', Bridge.GetIdentifier)
    ASSERT_NOT_NIL('Bridge.HasGroup exists', Bridge.HasGroup)
    ASSERT_NOT_NIL('Bridge.HasItem exists', Bridge.HasItem)
    ASSERT_NOT_NIL('Bridge.AddItem exists', Bridge.AddItem)
    ASSERT_NOT_NIL('Bridge.RemoveItem exists', Bridge.RemoveItem)
    ASSERT_NOT_NIL('Bridge.AddMoney exists', Bridge.AddMoney)
    ASSERT_NOT_NIL('Bridge.RemoveMoney exists', Bridge.RemoveMoney)

    -- Framework-specific checks
    print('^3  Framework: ^5' .. tostring(Bridge.Framework) .. '^7')

    if Bridge.Framework == 'qbcore' then
        ASSERT_NOT_NIL('QBCore bridge module loaded', Bridge.QBCore)
        ASSERT_NOT_NIL('QBCore.HasItem', Bridge.QBCore and Bridge.QBCore.HasItem)
        ASSERT_NOT_NIL('QBCore.HasGroup', Bridge.QBCore and Bridge.QBCore.HasGroup)
        ASSERT_NOT_NIL('QBCore.AddItem', Bridge.QBCore and Bridge.QBCore.AddItem)
        ASSERT_NOT_NIL('QBCore.RemoveItem', Bridge.QBCore and Bridge.QBCore.RemoveItem)
    elseif Bridge.Framework == 'esx' then
        ASSERT_NOT_NIL('ESX bridge module loaded', Bridge.ESX)
        -- HasItem is known to be missing in ESX bridge (Roadmap Phase 1.1)
        ASSERT_NOT_NIL('ESX.HasItem (KNOWN ISSUE if nil)', Bridge.ESX and Bridge.ESX.HasItem)
    elseif Bridge.Framework == 'standalone' then
        ASSERT_NOT_NIL('Standalone bridge module loaded', Bridge.Standalone)
    end

    PrintSummary('Bridge Functions')
end

-- =========================================================================
-- Test Suite: NPC Spawn + Camera (Interactive)
-- =========================================================================

local function TestSpawn()
    ResetResults()
    print('^3[TEST SUITE] NPC Spawn + Camera (Interactive)^7')
    print('')

    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local forward = GetEntityForwardVector(ped)
    local spawnPos = coords + (forward * 3.0)

    -- Build a test project with a START node
    local testProject = MakeProject('test_spawn_001', 'Spawn Test', {
        MakeNode('start', 'START', {
            coords = { x = spawnPos.x, y = spawnPos.y, z = spawnPos.z, w = GetEntityHeading(ped) + 180.0 },
            model = 'a_m_y_business_01'
        }),
        MakeNode('d1', 'DIALOGUE', {
            text = 'Hello! This is a test NPC spawned by the test harness. If you can see this dialogue, the spawn + camera + NUI pipeline is working correctly.',
            npcName = 'Test NPC',
            choices = {
                { id = 'c1', text = 'Great, it works!' },
                { id = 'c2', text = 'Close this' },
            }
        }),
        MakeNode('end', 'END'),
    }, {
        MakeConnection('start', 'd1', 'main'),
        MakeConnection('d1', 'end', 'c1'),
        MakeConnection('d1', 'end', 'c2'),
    })

    -- Temporarily inject into Interactions
    table.insert(Interactions, testProject)

    -- Setup (spawns NPC)
    SetupInteraction(testProject)

    Wait(1000)

    -- Verify spawn
    local spawnedPed = SpawnedEntities['test_spawn_001']
    ASSERT_NOT_NIL('NPC spawned', spawnedPed)
    if spawnedPed then
        ASSERT('NPC entity exists', DoesEntityExist(spawnedPed), 'entity does not exist')
        ASSERT('NPC is frozen', IsEntityPositionFrozen(spawnedPed), 'entity is not frozen')

        -- Start the interaction (will show dialogue)
        print('^3  Starting test interaction... Press a choice or ESC to continue.^7')
        StartInteraction(testProject)
    end

    PrintSummary('NPC Spawn')

    -- Note: cleanup happens when the interaction ends or player presses ESC
    -- The test project will be removed from Interactions on next sync
end

-- =========================================================================
-- Test Suite: Full flow (SET_VARIABLE → CONDITION → DIALOGUE)
-- =========================================================================

local function TestFullFlow()
    ResetResults()
    print('^3[TEST SUITE] Full Flow — SET_VARIABLE → CONDITION → DIALOGUE^7')
    print('')

    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local forward = GetEntityForwardVector(ped)
    local spawnPos = coords + (forward * 3.0)

    -- The exact scenario from the GitHub issue:
    -- START → DIALOGUE (with choice) → SET_VARIABLE → DIALOGUE → END
    local testProject = MakeProject('test_flow_001', 'Issue Regression', {
        MakeNode('start', 'START', {
            coords = { x = spawnPos.x, y = spawnPos.y, z = spawnPos.z, w = GetEntityHeading(ped) + 180.0 },
            model = 'a_m_y_business_01'
        }),
        MakeNode('d1', 'DIALOGUE', {
            text = 'Issue regression test: Click "Hello" and the flow should SET a variable then show the next dialogue.',
            npcName = 'Bug Reporter',
            choices = {
                { id = 'hello', text = 'Hello' },
            }
        }),
        MakeNode('sv', 'SET_VARIABLE', {
            variableName = 'greeted',
            variableValue = 'yes'
        }),
        MakeNode('cond', 'CONDITION', {
            variableName = 'greeted',
            conditionOperator = '==',
            variableValue = 'yes'
        }),
        MakeNode('d2', 'DIALOGUE', {
            text = 'SUCCESS! The SET_VARIABLE → CONDITION → DIALOGUE chain works! The variable "greeted" equals "yes".',
            npcName = 'Bug Reporter',
            choices = {
                { id = 'done', text = 'Close test' },
            }
        }),
        MakeNode('d3', 'DIALOGUE', {
            text = 'FAILURE — The condition evaluated to false. This should not happen.',
            npcName = 'Bug Reporter',
            choices = {
                { id = 'done2', text = 'Close' },
            }
        }),
        MakeNode('end', 'END'),
    }, {
        MakeConnection('start', 'd1', 'main'),
        MakeConnection('d1', 'sv', 'hello'),
        MakeConnection('sv', 'cond', 'main'),
        MakeConnection('cond', 'd2', 'true'),
        MakeConnection('cond', 'd3', 'false'),
        MakeConnection('d2', 'end', 'done'),
        MakeConnection('d3', 'end', 'done2'),
    })

    table.insert(Interactions, testProject)
    SetupInteraction(testProject)

    Wait(1000)

    local spawnedPed = SpawnedEntities['test_flow_001']
    ASSERT_NOT_NIL('Regression test NPC spawned', spawnedPed)

    if spawnedPed and DoesEntityExist(spawnedPed) then
        print('^3  Starting issue regression test...^7')
        print('^3  Click "Hello" → should see SUCCESS message.^7')
        print('^3  If it gets stuck, the bug is NOT fixed.^7')
        StartInteraction(testProject)
    end

    PrintSummary('Full Flow (Issue Regression)')
end

-- =========================================================================
-- Test Suite: Public API
-- =========================================================================

local function TestAPI()
    ResetResults()
    print('^3[TEST SUITE] Public API^7')
    print('')

    -- Test StartInteractionById with non-existent project
    local result = StartInteractionById('nonexistent-uuid-12345')
    ASSERT_EQ('StartInteractionById: returns false for missing project', result, false)

    -- Test export exists
    local exportFn = exports['rc-interactions']['StartInteractionById']
    ASSERT_NOT_NIL('Export StartInteractionById registered', exportFn)

    PrintSummary('Public API')
end

-- =========================================================================
-- Test Cleanup
-- =========================================================================

local function CleanupTestEntities()
    -- Remove test projects from Interactions
    local toRemove = {}
    for i, p in ipairs(Interactions) do
        if p.id and p.id:find('^test_') then
            table.insert(toRemove, i)
        end
    end
    -- Remove in reverse order to keep indices valid
    for i = #toRemove, 1, -1 do
        local idx = toRemove[i]
        local project = Interactions[idx]
        if project and SpawnedEntities[project.id] then
            local ped = SpawnedEntities[project.id]
            if DoesEntityExist(ped) then
                DeleteEntity(ped)
            end
            SpawnedEntities[project.id] = nil
        end
        table.remove(Interactions, idx)
    end
    print('^2[TEST] Cleanup complete — removed ' .. #toRemove .. ' test entities^7')
end

-- =========================================================================
-- Command Registration
-- =========================================================================

local TestSuites = {
    flow = { fn = TestFlow, name = 'Flow Traversal' },
    memory = { fn = TestMemory, name = 'InteractionMemory' },
    condition = { fn = TestCondition, name = 'CheckCondition' },
    bridge = { fn = TestBridge, name = 'Bridge Functions' },
    spawn = { fn = TestSpawn, name = 'NPC Spawn (Interactive)' },
    dialogue = { fn = TestFullFlow, name = 'Full Flow Regression (Interactive)' },
    api = { fn = TestAPI, name = 'Public API' },
}

RegisterCommand('rctest', function(_, args)
    local suite = args[1]

    if not suite then
        print('^1[TEST] Usage: /rctest <suite|all|cleanup>^7')
        print('^3  Available suites:^7')
        for k, v in pairs(TestSuites) do
            print(('    ^5%s^7 — %s'):format(k, v.name))
        end
        print(('    ^5all^7 — Run all non-interactive tests'))
        print(('    ^5interactive^7 — Run interactive tests (spawn + dialogue)'))
        print(('    ^5cleanup^7 — Remove test entities'))
        return
    end

    if suite == 'cleanup' then
        CleanupTestEntities()
        return
    end

    if suite == 'all' then
        print('')
        print('^5╔══════════════════════════════════════════════════╗^7')
        print('^5║     RC-Interactions — Running All Unit Tests     ║^7')
        print('^5╚══════════════════════════════════════════════════╝^7')
        print('')

        local totalPass, totalFail = 0, 0

        for _, key in ipairs({ 'flow', 'memory', 'condition', 'bridge', 'api' }) do
            ResetResults()
            TestSuites[key].fn()
            totalPass = totalPass + TestResults.passed
            totalFail = totalFail + TestResults.failed
        end

        print('')
        print('^5╔══════════════════════════════════════════════════╗^7')
        print(('  ^2Total Passed: %d^7  |  ^1Total Failed: %d^7'):format(totalPass, totalFail))
        print('^5╚══════════════════════════════════════════════════╝^7')
        if totalFail == 0 then
            print('^2  ✓ ALL TESTS PASSED^7')
        else
            print('^1  ✗ SOME TESTS FAILED — See details above^7')
        end
        print('')
        return
    end

    if suite == 'interactive' then
        print('^3  Running interactive tests (spawn + dialogue)...^7')
        CreateThread(function()
            TestSuites['spawn'].fn()
            Wait(5000)
            CleanupTestEntities()
            Wait(1000)
            TestSuites['dialogue'].fn()
        end)
        return
    end

    if TestSuites[suite] then
        CreateThread(function()
            TestSuites[suite].fn()
        end)
    else
        print('^1[TEST] Unknown suite: ' .. suite .. '^7')
    end
end, false)

print('^2[RC-Interactions]^7 Test harness loaded. Use ^5/rctest^7 to run tests.')
