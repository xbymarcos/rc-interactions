--[[
    RC-Interactions — Server Test Harness
    ======================================
    Tests database operations, sync, permissions, and bridge functions
    from the server side.

    Usage (server console or rcon):
        rctest_sv all          — Run all server tests
        rctest_sv db           — Test database operations (CRUD)
        rctest_sv bridge       — Test server-side bridge functions
        rctest_sv sync         — Test sync pipeline
        rctest_sv permissions  — Test permission checks

    Results are printed to the server console with color codes.
]]

-- Guard: only register if debug mode is on
if not Config or not Config.Debug then return end

-- =========================================================================
-- Test Framework (minimal — server side)
-- =========================================================================

local SvResults = { passed = 0, failed = 0, errors = {} }

local function SV_PASS(name)
    SvResults.passed = SvResults.passed + 1
    print('^2[SV TEST PASS]^7 ' .. name)
end

local function SV_FAIL(name, reason)
    SvResults.failed = SvResults.failed + 1
    table.insert(SvResults.errors, { name = name, reason = reason })
    print('^1[SV TEST FAIL]^7 ' .. name .. ' — ' .. tostring(reason))
end

local function SV_ASSERT(name, condition, reason)
    if condition then SV_PASS(name) else SV_FAIL(name, reason or 'assertion failed') end
end

local function SV_ASSERT_EQ(name, actual, expected)
    if actual == expected then SV_PASS(name)
    else SV_FAIL(name, ('expected %s but got %s'):format(tostring(expected), tostring(actual))) end
end

local function SV_ASSERT_NOT_NIL(name, value)
    if value ~= nil then SV_PASS(name) else SV_FAIL(name, 'expected non-nil') end
end

local function SvResetResults()
    SvResults = { passed = 0, failed = 0, errors = {} }
end

local function SvPrintSummary(suiteName)
    local total = SvResults.passed + SvResults.failed
    print('')
    print('^5══════════════════════════════════════════════════^7')
    print('^5  Server Test Results: ^7' .. suiteName)
    print('^5══════════════════════════════════════════════════^7')
    print(('  ^2Passed: %d^7  |  ^1Failed: %d^7  |  Total: %d'):format(
        SvResults.passed, SvResults.failed, total))
    if #SvResults.errors > 0 then
        print('^1  Failed:^7')
        for i, e in ipairs(SvResults.errors) do
            print(('    %d. %s — %s'):format(i, e.name, e.reason))
        end
    end
    print('^5══════════════════════════════════════════════════^7')
    print('')
end

-- =========================================================================
-- Test Suite: Database CRUD
-- =========================================================================

local TEST_UUID = 'rctest-00000000-0000-0000-0000-000000000001'
local TEST_GROUP = '__rctest_group__'

local function TestDB(callback)
    SvResetResults()
    print('^3[SV TEST SUITE] Database CRUD^7')
    print('')

    -- Step 1: Ensure group
    MySQL.insert('INSERT IGNORE INTO rc_interaction_groups (name) VALUES (?)', { TEST_GROUP }, function(groupInsertId)
        SV_ASSERT('DB: insert test group', groupInsertId ~= nil, 'insert returned nil')

        -- Get group id
        MySQL.scalar('SELECT id FROM rc_interaction_groups WHERE name = ?', { TEST_GROUP }, function(groupId)
            SV_ASSERT_NOT_NIL('DB: group id retrieved', groupId)

            -- Step 2: Insert test project
            local testData = json.encode({
                nodes = {
                    { id = 's', type = 'START', position = { x = 0, y = 0 }, data = {} },
                    { id = 'e', type = 'END', position = { x = 100, y = 0 }, data = {} },
                },
                connections = {
                    { id = 'c1', fromNodeId = 's', fromPort = 'main', toNodeId = 'e' },
                }
            })

            MySQL.insert(
                'INSERT INTO rc_interactions (uuid, name, group_id, data) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = ?, data = ?',
                { TEST_UUID, 'Test Project', groupId, testData, 'Test Project', testData },
                function(insertId)
                    SV_ASSERT('DB: insert test project', insertId ~= nil, 'insert returned nil')

                    -- Step 3: Read it back
                    MySQL.single('SELECT * FROM rc_interactions WHERE uuid = ?', { TEST_UUID }, function(row)
                        SV_ASSERT_NOT_NIL('DB: read test project', row)
                        if row then
                            SV_ASSERT_EQ('DB: project name', row.name, 'Test Project')
                            SV_ASSERT_EQ('DB: project uuid', row.uuid, TEST_UUID)
                            SV_ASSERT_NOT_NIL('DB: project data not nil', row.data)

                            -- Verify JSON is valid
                            local decoded = json.decode(row.data)
                            SV_ASSERT_NOT_NIL('DB: data is valid JSON', decoded)
                            if decoded then
                                SV_ASSERT_EQ('DB: nodes count', #decoded.nodes, 2)
                                SV_ASSERT_EQ('DB: connections count', #decoded.connections, 1)
                            end
                        end

                        -- Step 4: Update
                        MySQL.update('UPDATE rc_interactions SET name = ? WHERE uuid = ?', { 'Updated Test', TEST_UUID }, function(affected)
                            SV_ASSERT('DB: update project', affected and affected > 0, 'no rows affected')

                            MySQL.scalar('SELECT name FROM rc_interactions WHERE uuid = ?', { TEST_UUID }, function(name)
                                SV_ASSERT_EQ('DB: updated name', name, 'Updated Test')

                                -- Step 5: Delete
                                MySQL.query('DELETE FROM rc_interactions WHERE uuid = ?', { TEST_UUID }, function()
                                    MySQL.scalar('SELECT COUNT(*) FROM rc_interactions WHERE uuid = ?', { TEST_UUID }, function(count)
                                        SV_ASSERT_EQ('DB: project deleted', tonumber(count), 0)

                                        -- Cleanup test group
                                        MySQL.query('DELETE FROM rc_interaction_groups WHERE name = ?', { TEST_GROUP }, function()
                                            SV_PASS('DB: test group cleaned up')
                                            SvPrintSummary('Database CRUD')
                                            if callback then callback() end
                                        end)
                                    end)
                                end)
                            end)
                        end)
                    end)
                end
            )
        end)
    end)
end

-- =========================================================================
-- Test Suite: Server Bridge Functions
-- =========================================================================

local function TestServerBridge(callback)
    SvResetResults()
    print('^3[SV TEST SUITE] Server Bridge Functions^7')
    print('')

    SV_ASSERT_NOT_NIL('Bridge exists', Bridge)
    SV_ASSERT_NOT_NIL('Bridge.Framework', Bridge.Framework)
    SV_ASSERT('Bridge.Ready', Bridge.Ready == true, 'not ready')

    -- Function existence checks
    SV_ASSERT_NOT_NIL('Bridge.Notify', Bridge.Notify)
    SV_ASSERT_NOT_NIL('Bridge.GetIdentifier', Bridge.GetIdentifier)
    SV_ASSERT_NOT_NIL('Bridge.HasGroup', Bridge.HasGroup)
    SV_ASSERT_NOT_NIL('Bridge.HasItem', Bridge.HasItem)
    SV_ASSERT_NOT_NIL('Bridge.AddItem', Bridge.AddItem)
    SV_ASSERT_NOT_NIL('Bridge.RemoveItem', Bridge.RemoveItem)
    SV_ASSERT_NOT_NIL('Bridge.AddMoney', Bridge.AddMoney)
    SV_ASSERT_NOT_NIL('Bridge.RemoveMoney', Bridge.RemoveMoney)

    print('^3  Framework: ^5' .. tostring(Bridge.Framework) .. '^7')

    -- Test with a real player if available
    local players = GetPlayers()
    if #players > 0 then
        local testSrc = tonumber(players[1])
        print('^3  Testing with player source: ^5' .. tostring(testSrc) .. '^7')

        -- GetIdentifier
        local identifier = Bridge.GetIdentifier(testSrc)
        SV_ASSERT_NOT_NIL('Bridge.GetIdentifier returns value', identifier)
        print('^3    Identifier: ^5' .. tostring(identifier) .. '^7')

        -- HasGroup (admin check)
        local hasAdmin = Bridge.HasGroup(testSrc, Config.EditorGroup)
        SV_ASSERT('Bridge.HasGroup returns boolean', type(hasAdmin) == 'boolean', 'returned ' .. type(hasAdmin))
        print('^3    HasGroup("' .. Config.EditorGroup .. '"): ^5' .. tostring(hasAdmin) .. '^7')
    else
        print('^3  No players online — skipping live bridge tests^7')
    end

    SvPrintSummary('Server Bridge')
    if callback then callback() end
end

-- =========================================================================
-- Test Suite: Sync Pipeline
-- =========================================================================

local function TestSync(callback)
    SvResetResults()
    print('^3[SV TEST SUITE] Sync Pipeline^7')
    print('')

    -- Test that loading projects from DB works
    MySQL.query('SELECT COUNT(*) as cnt FROM rc_interactions', {}, function(result)
        local count = result and result[1] and result[1].cnt or 0
        SV_ASSERT('DB: can query interactions count', count ~= nil, 'query failed')
        print('^3  Total interactions in DB: ^5' .. tostring(count) .. '^7')

        -- Test full load query
        MySQL.query('SELECT i.*, g.name as group_name FROM rc_interactions i LEFT JOIN rc_interaction_groups g ON i.group_id = g.id', {}, function(rows)
            SV_ASSERT_NOT_NIL('DB: full load query returns result', rows)
            if rows then
                SV_ASSERT_EQ('DB: row count matches', #rows, tonumber(count))

                -- Verify each row has required fields
                local allValid = true
                for _, row in ipairs(rows) do
                    if not row.uuid or not row.data then
                        allValid = false
                        break
                    end
                    -- Verify JSON decodes
                    local ok, decoded = pcall(json.decode, row.data)
                    if not ok or not decoded then
                        allValid = false
                        break
                    end
                end
                SV_ASSERT('DB: all rows have valid uuid + JSON data', allValid, 'some rows have invalid data')
            end

            SvPrintSummary('Sync Pipeline')
            if callback then callback() end
        end)
    end)
end

-- =========================================================================
-- Test Suite: Permissions
-- =========================================================================

local function TestPermissions(callback)
    SvResetResults()
    print('^3[SV TEST SUITE] Permissions^7')
    print('')

    SV_ASSERT_NOT_NIL('Config.EditorGroup defined', Config.EditorGroup)
    SV_ASSERT_NOT_NIL('Config.EditorCommand defined', Config.EditorCommand)
    print('^3  EditorGroup: ^5' .. tostring(Config.EditorGroup) .. '^7')
    print('^3  EditorCommand: ^5' .. tostring(Config.EditorCommand) .. '^7')

    -- Test with real players if available
    local players = GetPlayers()
    if #players > 0 then
        local testSrc = tonumber(players[1])
        local hasGroup = Bridge.HasGroup(testSrc, Config.EditorGroup)
        SV_ASSERT('Permission check returns boolean', type(hasGroup) == 'boolean', type(hasGroup))
        print('^3  Player ' .. tostring(testSrc) .. ' has "' .. Config.EditorGroup .. '": ^5' .. tostring(hasGroup) .. '^7')

        -- Test with a non-existent group
        local hasFake = Bridge.HasGroup(testSrc, 'nonexistent_group_xyz')
        SV_ASSERT_EQ('Permission: non-existent group returns false', hasFake, false)
    else
        print('^3  No players online — skipping live permission tests^7')
    end

    SvPrintSummary('Permissions')
    if callback then callback() end
end

-- =========================================================================
-- Command Registration
-- =========================================================================

RegisterCommand('rctest_sv', function(source, args)
    -- Server-only command (source = 0)
    if source ~= 0 then
        print('^1[SV TEST] This command can only be run from the server console.^7')
        return
    end

    local suite = args[1]

    if not suite then
        print('^1[SV TEST] Usage: rctest_sv <suite|all>^7')
        print('^3  Suites: db, bridge, sync, permissions, all^7')
        return
    end

    if suite == 'all' then
        print('')
        print('^5╔══════════════════════════════════════════════════╗^7')
        print('^5║   RC-Interactions — Running All Server Tests     ║^7')
        print('^5╚══════════════════════════════════════════════════╝^7')
        print('')

        -- Chain async tests
        TestDB(function()
            TestServerBridge(function()
                TestSync(function()
                    TestPermissions(function()
                        print('')
                        print('^5╔══════════════════════════════════════════════════╗^7')
                        print('^5║         All Server Tests Complete                ║^7')
                        print('^5╚══════════════════════════════════════════════════╝^7')
                    end)
                end)
            end)
        end)
        return
    end

    local suites = {
        db = TestDB,
        bridge = TestServerBridge,
        sync = TestSync,
        permissions = TestPermissions,
    }

    if suites[suite] then
        suites[suite]()
    else
        print('^1[SV TEST] Unknown suite: ' .. suite .. '^7')
    end
end, true) -- restricted = true (rcon only)

print('^2[RC-Interactions]^7 Server test harness loaded. Use ^5rctest_sv^7 in server console.')
