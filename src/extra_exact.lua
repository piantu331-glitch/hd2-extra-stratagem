-- HD2-Addon: mods/dsh/extra_exact
--
-- Give ONE extra Tank to each stratagem the user actually carries.
--
-- Build    : 25480438 / exe 1.8.46015.0
-- game.dll : 2e2c3b7c2500646dadd5f2b4c6e0504dbb7e7896139f64cddc0d1813c718f51e
--
-- =========================================================================
-- HOW THE TARGETS WERE IDENTIFIED -- no guessing this time
-- =========================================================================
-- Every stratagem record carries the name-hash of its own sound/effect asset at
-- +168 and of its icon at +176. Extracting the game with Filediver gives the
-- asset list, which turns those hashes into file names that say what the
-- stratagem is. Verified pairs:
--
--     kind   4  +168 = orbital_gatling_barrage   -> Orbital Gatling Barrage
--     kind 106  +168 = orbital_napalm_barrage    -> Orbital Napalm Barrage
--     kind  58  +168 = orbital_railcannon        -> Orbital Railcannon Strike
--     kind  18  +168 = eagle_airstrike           -> Eagle Airstrike
--     kind  30  +168 = eagle_base                -> Eagle Strafing Run
--     kind  65  +168 = eagle_clusterbombs        -> Eagle Cluster Bomb
--     kind   3  +168 = eagle_bomb                -> Eagle 500kg Bomb
--     kind 101  +176 = ...supportbackpack_ammo   -> B-1 Supply Pack
--     kind 121  +176 = ...turrets_machinegun     -> A/MG-43 Machine Gun Sentry
--     kind  66  +176 = ...turrets_gatling        -> A/G-16 Gatling Sentry
--     kind  53  +176 = ...turrets_rocket         -> A/MLS-4X Rocket Sentry
--     kind  46  +176 = ...gas_mine               -> MD-8 Gas Mines
--
-- NOTE: earlier attempts guessed kinds 47/95/60 (sentries) and 76/78/79/129
-- (eagles). Those were WRONG, which is exactly why the test produced nothing.
--
-- =========================================================================
-- IMPORTANT: THE EAGLES ALREADY GRANT AN EXTRA
-- =========================================================================
-- The engine ships 10 records whose +200 is already 49, meaning "also grant
-- kind 49". Three of the user's Eagles are among them:
--
--     kind 30  Eagle Strafing Run   (engine host)
--     kind  3  Eagle 500kg Bomb     (engine host)
--     kind 18  Eagle Airstrike      (engine host)
--
-- Overwriting their +200 with Tank keeps the COUNT at one extra per host but
-- replaces the built-in grant. That is intended here -- the user wants Tank --
-- and it is stated plainly rather than hidden. The other 7 engine hosts are
-- left untouched.
--
-- =========================================================================
-- SAFETY
-- =========================================================================
--   * game.dll SHA-256 verified before any write
--   * full 80280-byte blob walked with bounds checks; must be exactly 80280
--     bytes and exactly 149 records
--   * blob read twice and compared before the first write
--   * only +200 of the listed records is touched
--   * every write read back and verified; failures reported
--   * writes only to private/mapped writable pages; MEM_IMAGE refused
--   * all original values restored on shutdown

local M = { name='ExtraExact', version='1.0.0', status='starting', disabled=false }
local NAME = M.name
local VERSION = M.version

local GAME_SHA = '2e2c3b7c2500646dadd5f2b4c6e0504dbb7e7896139f64cddc0d1813c718f51e'
local SETTINGS_RVA = 0x348e8f8
local BLOB_SIZE = 80280
local RECORD_SIZE = 400
local GROUP_MAGIC = 0x444c444c
local GROUP_HASH = 0x30eb6399
local GRANT_KIND = 1        -- Tank

-- the user's stratagems, each identified from the game's own assets
local TARGETS = {
    {kind=  4, name='Orbital Gatling Barrage'},
    {kind=106, name='Orbital Napalm Barrage'},
    {kind= 58, name='Orbital Railcannon Strike'},
    {kind= 18, name='Eagle Airstrike'},
    {kind= 30, name='Eagle Strafing Run'},
    {kind= 65, name='Eagle Cluster Bomb'},
    {kind=  3, name='Eagle 500kg Bomb'},
    {kind=101, name='B-1 Supply Pack'},
    {kind=121, name='A/MG-43 Machine Gun Sentry'},
    {kind= 66, name='A/G-16 Gatling Sentry'},
    {kind= 53, name='A/MLS-4X Rocket Sentry'},
    {kind= 46, name='MD-8 Gas Mines'},
}

local S = { log={}, disabled=false, frames=0, ticks=0, api=nil, owner=nil,
            phase='locate', saved=nil, max_tries=1800, last_why=nil }

local function u32(s,at)
    if type(s)~='string' or #s<at+4 then return nil end
    local a,b,c,d=s:byte(at+1,at+4)
    return a+b*256+c*65536+d*16777216
end
local function le32(v)
    return string.char(v%256, math.floor(v/256)%256, math.floor(v/65536)%256, math.floor(v/16777216)%256)
end

local function base_dir() local l=os.getenv('LOCALAPPDATA') or '.' return l..'\\CowboyBingus\\Helldivers2\\Logs' end
local function write_file(n,c) local f=io.open(base_dir()..'\\'..n,'wb') if not f then return false end f:write(c) f:close() return true end
local function emit(m) S.log[#S.log+1]=os.date('!%Y-%m-%dT%H:%M:%SZ')..' '..m M.status=m print('['..NAME..'] '..m) end
local function flush_log() if S.owner and S.owner.open_log then local f=S.owner.open_log(NAME..'.log') if f then f:write(table.concat(S.log,'\n')..'\n') f:close() end end end
local function write_status(v,d) write_file(NAME..'-STATUS.txt',table.concat({
    v,'','mod      : '..NAME..' v'..VERSION,'build    : 25480438 / exe 1.8.46015.0',
    'phase    : '..tostring(S.phase),'status   : '..tostring(S.status),
    'grant    : '..tostring(GRANT_KIND)..' (Tank)',
    'targets  : 12 stratagems identified from game assets',
    'last why : '..tostring(S.last_why),
    'detail   : '..tostring(d or '')},'\n')..'\n') end

local function make_api()
    local ffi=require('ffi')
    if ffi.os~='Windows' or not ffi.abi('64bit') then return nil,'windows_x64_required' end
    ffi.cdef[[
        void *GetModuleHandleA(const char *);
        uint32_t GetModuleFileNameW(void *,uint16_t *,uint32_t);
        void *GetCurrentProcess(void);
        int ReadProcessMemory(void *,const void *,void *,size_t,size_t *);
        int WriteProcessMemory(void *,void *,const void *,size_t,size_t *);
        size_t VirtualQuery(const void *,void *,size_t);
        int VirtualProtect(void *,size_t,uint32_t,uint32_t *);
        uint32_t GetLastError(void);
        void *CreateFileW(const uint16_t *,uint32_t,uint32_t,void *,uint32_t,uint32_t,void *);
        int ReadFile(void *,void *,uint32_t,uint32_t *,void *);
        int CloseHandle(void *);
        int32_t BCryptOpenAlgorithmProvider(void **,const uint16_t *,const uint16_t *,uint32_t);
        int32_t BCryptCreateHash(void *,void **,void *,uint32_t,const uint8_t *,uint32_t,uint32_t);
        int32_t BCryptHashData(void *,const void *,uint32_t,uint32_t);
        int32_t BCryptFinishHash(void *,uint8_t *,uint32_t,uint32_t);
        int32_t BCryptDestroyHash(void *);
        int32_t BCryptCloseAlgorithmProvider(void *,uint32_t);
        typedef struct { void *base; void *allocation; uint32_t protection0;
            uint16_t partition; uint16_t reserved; size_t size;
            uint32_t state; uint32_t protection; uint32_t kind; } EX_REGION;
    ]]
    local k=ffi.load('kernel32'); local b=ffi.load('bcrypt'); local process=k.GetCurrentProcess()
    local api={}
    local buf=ffi.new('uint8_t[262144]'); local cnt=ffi.new('size_t[1]')
    local bufaddr=tonumber(ffi.cast('uintptr_t',buf))
    local function excluded(a,sz) return a<bufaddr+262144 and a+sz>bufaddr end
    function api.module(n) local p=k.GetModuleHandleA(n) if p==nil then return nil end
        local v=tonumber(ffi.cast('uintptr_t',p)) if v and v~=0 then return v end end
    function api.query(address)
        if address>=0x800000000000 then return nil end
        local info=ffi.new('EX_REGION[1]')
        if tonumber(k.VirtualQuery(ffi.cast('void *',address),info,ffi.sizeof(info[0])))~=ffi.sizeof(info[0]) then return nil end
        local r=info[0]
        return {base=tonumber(ffi.cast('uintptr_t',r.base)), size=tonumber(r.size),
                state=tonumber(r.state), protection=tonumber(r.protection), kind=tonumber(r.kind)}
    end
    local function readable(r)
        if not r or r.state~=0x1000 then return false end
        local p=r.protection%256
        return (p==2 or p==4 or p==8 or p==32 or p==64 or p==128) and r.protection<256
    end
    function api.read_blob(address,size)
        if type(size)~='number' or size<=0 or size>262144 or excluded(address,size) then return nil end
        local r=api.query(address)
        if not readable(r) or (r.kind~=0x20000 and r.kind~=0x40000) then return nil end
        if address<r.base or address+size>r.base+r.size then return nil end
        if k.ReadProcessMemory(process,ffi.cast('const void *',address),buf,size,cnt)==0
           or tonumber(cnt[0])~=size then return nil end
        return ffi.string(buf,size)
    end
    function api.read_module(address,size)
        if type(size)~='number' or size<=0 or size>262144 or excluded(address,size) then return nil end
        local r=api.query(address)
        if not r or r.kind~=0x1000000 or r.state~=0x1000 then return nil end
        local p=r.protection%256
        if not (p==2 or p==4 or p==8 or p==32 or p==64 or p==128) or r.protection>=256 then return nil end
        if address<r.base or address+size>r.base+r.size then return nil end
        if k.ReadProcessMemory(process,ffi.cast('const void *',address),buf,size,cnt)==0
           or tonumber(cnt[0])~=size then return nil end
        return ffi.string(buf,size)
    end
    function api.pointer(bytes)
        if not bytes or #bytes~=8 then return nil end
        local p=ffi.new('uint64_t[1]'); ffi.copy(p,bytes,8)
        local v=tonumber(p[0]); if v<65536 or v>=0x800000000000 then return nil end return v
    end
    function api.write(address,bytes)
        if type(bytes)~='string' or #bytes~=4 then return false,'invalid_size' end
        local r=api.query(address)
        if not r or r.state~=0x1000 then return false,'region' end
        if r.kind==0x1000000 then return false,'refuse_module_image' end
        if r.kind~=0x20000 and r.kind~=0x40000 then return false,'not_private' end
        if address<r.base or address+#bytes>r.base+r.size then return false,'bounds' end
        local p=r.protection%256
        local before=api.read_blob(address,#bytes)
        if not before then return false,'pre_read' end
        local changed=false; local old=ffi.new('uint32_t[1]')
        if p~=4 then
            if k.VirtualProtect(ffi.cast('void *',address),#bytes,4,old)==0 then
                return false,'protect_failed_'..tonumber(k.GetLastError())
            end
            changed=true
        end
        local wcnt=ffi.new('size_t[1]')
        local ok=k.WriteProcessMemory(process,ffi.cast('void *',address),bytes,#bytes,wcnt)~=0
            and tonumber(wcnt[0])==#bytes
        local restored=true
        if changed then
            local ig=ffi.new('uint32_t[1]')
            restored=k.VirtualProtect(ffi.cast('void *',address),#bytes,old[0],ig)~=0
        end
        local after=api.read_blob(address,#bytes)
        return ok and restored and after==bytes, 'ok='..tostring(ok)..' restored='..tostring(restored)
    end
    function api.module_hash(addr)
        local path=ffi.new('uint16_t[32768]')
        local n=k.GetModuleFileNameW(ffi.cast('void *',addr),path,32768)
        if n==0 or n>=32768 then return nil end
        local f=k.CreateFileW(path,0x80000000,7,nil,3,0x08000000,nil)
        if f==ffi.cast('void *',-1) then return nil end
        local alg,hash=ffi.new('void *[1]'),ffi.new('void *[1]')
        local ok,res=pcall(function()
            local nm=ffi.new('uint16_t[7]',{83,72,65,50,53,54,0})
            assert(b.BCryptOpenAlgorithmProvider(alg,nm,nil,0)==0)
            assert(b.BCryptCreateHash(alg[0],hash,nil,0,nil,0,0)==0)
            local chunk=ffi.new('uint8_t[65536]'); local got=ffi.new('uint32_t[1]')
            while true do assert(k.ReadFile(f,chunk,65536,got,nil)~=0)
                if got[0]==0 then break end
                assert(b.BCryptHashData(hash[0],chunk,got[0],0)==0) end
            local d=ffi.new('uint8_t[32]'); assert(b.BCryptFinishHash(hash[0],d,32,0)==0)
            local p2={} for i=0,31 do p2[#p2+1]=string.format('%02x',d[i]) end
            return table.concat(p2) end)
        if hash[0]~=nil then b.BCryptDestroyHash(hash[0]) end
        if alg[0]~=nil then b.BCryptCloseAlgorithmProvider(alg[0],0) end
        k.CloseHandle(f)
        if not ok then return nil end return res
    end
    return api
end

local function map_records()
    local api=S.api
    local game=api.module('game.dll')
    if not game then return nil,'no_game_dll' end
    if api.module_hash(game)~=GAME_SHA then return nil,'game_dll_hash_mismatch' end
    local pb=api.read_module(game+SETTINGS_RVA,8)
    if not pb then return nil,'settings_slot_unreadable' end
    local buffer=api.pointer(pb)
    if not buffer then return nil,'settings_null' end
    local src=api.read_blob(buffer,BLOB_SIZE)
    if not src then return nil,'settings_not_ready' end
    if u32(src,0)~=11 then return nil,'group_count_mismatch' end
    local list={}
    local offset=4
    for group=1,11 do
        if u32(src,offset)~=GROUP_MAGIC or u32(src,offset+4)~=1 or u32(src,offset+8)~=GROUP_HASH then
            return nil,'dl_header_mismatch'
        end
        local size=u32(src,offset+12)
        local root=offset+24
        local finish=root+size
        if finish>#src then return nil,'group_bounds' end
        local count=u32(src,root+8)
        local start=api.pointer(src:sub(root+1,root+8))
        if not start then return nil,'record_pointer' end
        local rel=start-buffer
        if not count or rel<root+16 or rel+count*RECORD_SIZE>finish then return nil,'record_bounds' end
        for i=0,count-1 do
            local at=rel+i*RECORD_SIZE
            list[#list+1]={addr=start+i*RECORD_SIZE, kind=u32(src,at), extra=u32(src,at+200)}
        end
        offset=finish
    end
    if offset~=#src then return nil,'trailing_bytes' end
    if #list~=149 then return nil,'unexpected_record_count:'..#list end
    if api.read_blob(buffer,BLOB_SIZE)~=src then return nil,'blob_changed' end
    return list, buffer
end

local function apply()
    local list,buffer=map_records()
    if not list then return false,buffer end

    local saved, lines = {}, {}
    local wrote,skipped,missing,failed=0,0,0,0
    for _,t in ipairs(TARGETS) do
        local found=nil
        for _,r in ipairs(list) do if r.kind==t.kind then found=r break end end
        if not found then
            missing=missing+1
            lines[#lines+1]=string.format('%-30s kind %3d NOT FOUND', t.name, t.kind)
        else
            saved[#saved+1]={addr=found.addr, extra=found.extra or 0}
            if (found.extra or 0)==GRANT_KIND then
                skipped=skipped+1
                lines[#lines+1]=string.format('%-30s kind %3d already grants Tank', t.name, t.kind)
            else
                local was=found.extra or 0
                local ok,info=S.api.write(found.addr+200, le32(GRANT_KIND))
                local after=S.api.read_blob(found.addr+200,4)
                if ok and after and u32(after,0)==GRANT_KIND then
                    wrote=wrote+1
                    lines[#lines+1]=string.format('%-30s kind %3d  +200 %d -> 1  OK', t.name, t.kind, was)
                else
                    failed=failed+1
                    lines[#lines+1]=string.format('%-30s kind %3d  FAILED %s', t.name, t.kind, tostring(info))
                end
            end
        end
    end
    S.saved=saved
    local summary=string.format('targets=%d wrote=%d skipped=%d missing=%d failed=%d',
        #TARGETS, wrote, skipped, missing, failed)
    write_file(NAME..'-applied.txt', summary..'\n'..table.concat(lines,'\n')..'\n')
    if wrote==0 then return false,'nothing_written '..summary end
    return true, summary
end

local function startup()
    local loader=rawget(_G,'CowboyBingusModLoader')
    local apiv=type(loader)=='table' and tonumber(loader.api) or nil
    if not apiv or apiv<1 then
        S.phase='error'; S.status='loader_api_too_old'; S.disabled=true
        emit('need Bingus Shared Loader v15+/API 1'); write_status('FAILED - loader',''); return false
    end
    local api,err=make_api()
    if not api then
        S.phase='error'; S.status='ffi_unavailable'; S.disabled=true
        emit(S.status..': '..tostring(err)); write_status('FAILED - FFI',''); return false
    end
    S.api=api
    S.phase='locate'; S.status='waiting_for_settings'
    write_status('WORKING - waiting for the stratagem settings blob','')
    return true
end

local function tick()
    if S.disabled then return end
    S.frames=S.frames+1
    if S.phase=='done' then return end
    if S.frames%30~=0 then return end
    S.ticks=S.ticks+1
    local ok,info=apply()
    S.last_why=info
    if not ok then
        if S.ticks%60==0 then emit('attempt '..S.ticks..': '..tostring(info)) end
        if S.ticks>=S.max_tries then
            S.phase='error'; S.disabled=true; S.status='gave_up'
            emit('gave up: '..tostring(info)); write_status('FAILED', tostring(info))
        end
        return
    end
    S.phase='done'; S.status='applied'
    emit('applied: '..tostring(info))
    write_status('OK - one extra Tank per carried stratagem', tostring(info))
end

local loader=rawget(_G,'CowboyBingusModLoader')
if rawget(_G,'ExtraExact') then return rawget(_G,'ExtraExact') end
rawset(_G,'ExtraExact',M)
S.owner=loader
S.disabled=not startup()

if not S.disabled then
    local previous_update=rawget(_G,'update')
    local my_update
    my_update=function(dt,...)
        if not S.disabled then
            local ok,err=pcall(tick)
            if not ok then
                S.disabled=true; S.status='runtime_error: '..tostring(err)
                pcall(emit,S.status); pcall(write_status,'FAILED - runtime',tostring(err))
            end
        end
        if type(previous_update)=='function' then return previous_update(dt,...) end
    end
    M.my_update=my_update
    M.previous_update=previous_update
    rawset(_G,'update',my_update)
    local previous_shutdown=rawget(_G,'shutdown')
    rawset(_G,'shutdown',function(...)
        if S.saved and S.api then
            pcall(function()
                for _,r in ipairs(S.saved) do
                    S.api.write(r.addr+200, le32(r.extra))
                end
            end)
        end
        if rawget(_G,'update')==my_update and type(previous_update)=='function' then
            rawset(_G,'update',previous_update)
        end
        pcall(flush_log)
        if type(previous_shutdown)=='function' then return previous_shutdown(...) end
    end)
end

pcall(flush_log)
return M
