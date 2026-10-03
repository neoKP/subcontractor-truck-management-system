import React, { useEffect, useMemo, useState } from 'react';
import { MapPinned, Loader2, Info, X, Save, Lightbulb, Search, AlertTriangle } from 'lucide-react';
import { watchActiveFuelRates, type FuelRateVersion } from '../utils/fuelRateStore';
import { usePlaceAreas, savePlaceArea } from '../utils/placeAreaStore';
import { buildPlaceStats, rateAreaNames, rankAreaNames, areaOwners, placeClues, type PlaceStat, type PlaceClues } from '../utils/placeAreaSuggest';
import { canonicalSubcontractor } from '../utils/subcontractorAliases';
import { samePlace } from '../utils/placeAliases';
import { pageCount, pageNumbers as buildPageNumbers, pageSlice, PAGE_SIZE } from '../utils/pagination';
import type { Job, PriceMatrix } from '../types';

/*
  หน้า "จับคู่สถานที่" — บอกระบบว่าสถานที่ในใบงาน/ราคากลาง อยู่พื้นที่ไหนในตารางเรท

  ตารางเรทค่าขนส่ง (จากหน่วยงาน) เขียนต้นทาง/ปลายทางเป็นพื้นที่กว้าง เช่น "กทม ปริมณฑล"
  แต่ใบงานและราคากลางเขียนชื่อร้าน · ถ้าไม่จับคู่ ระบบหาเรทไม่เจอ

  สิ่งที่บันทึกที่นี่ "เพิ่ม" การจับคู่อย่างเดียว ไม่แตะรายการที่ยืนยันไว้ในโค้ด
  (utils/placeZones.ts) และไม่แก้ใบงานหรือราคากลาง
*/

type Filter = 'todo' | 'team' | 'all';

const STATUS_CHIP: Record<PlaceStat['status'], { label: string; cls: string }> = {
    exact: { label: 'ชื่อตรงกับตาราง', cls: 'bg-emerald-100 text-emerald-700' },
    area: { label: 'จับคู่พื้นที่แล้ว', cls: 'bg-indigo-100 text-indigo-700' },
    none: { label: 'ยังไม่จับคู่', cls: 'bg-rose-100 text-rose-700' },
};

/**
 * ช่องพิมพ์ค้นหาพื้นที่ในตารางเรท — แบบเดียวกับช่องเลือกบริษัทในหน้าเปิดใบงาน
 *
 * พิมพ์แล้วกรอง+เรียง (ตรงทั้งคำ → ขึ้นต้น → มีอยู่ข้างใน) · ↑↓ เลื่อน · Enter เลือก · Esc ปิด
 * เลือกแล้วเพิ่มทันที ไม่ต้องกดปุ่มเพิ่มอีกรอบ · รับได้เฉพาะชื่อที่มีในตาราง
 */
const AreaPicker: React.FC<{
    names: string[];
    exclude: string[];
    label: string;
    onPick: (area: string) => void;
    /** พื้นที่นี้อยู่ในตารางของเจ้าไหน */
    ownersOf: (area: string) => string[];
    /** ผู้รับเหมาที่วิ่งสถานที่นี้ */
    placeSubs: string[];
}> = ({ names, exclude, label, onPick, ownersOf, placeSubs }) => {
    const [text, setText] = useState('');
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const options = useMemo(
        () => rankAreaNames(names, text).filter(n => !exclude.some(e => samePlace(e, n))),
        [names, text, exclude]
    );
    useEffect(() => { setActive(0); }, [text]);

    const pick = (n: string | undefined) => {
        if (!n) return;
        onPick(n);
        setText('');
        setOpen(false);
    };

    return (
        <div className="relative min-w-0 w-full sm:w-80">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
                type="text"
                autoComplete="off"
                value={text}
                placeholder="พิมพ์ค้นหาพื้นที่ในตารางเรท…"
                aria-label={label}
                role="combobox"
                aria-expanded={open}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-sm outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500"
                onFocus={() => setOpen(true)}
                onChange={e => { setText(e.target.value); setOpen(true); }}
                // หน่วงก่อนปิด ให้ onMouseDown ของตัวเลือกทำงานทัน
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                onKeyDown={e => {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(i => Math.min(i + 1, options.length - 1)); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
                    else if (e.key === 'Enter') { e.preventDefault(); if (open) pick(options[active]); }
                    else if (e.key === 'Escape') { setOpen(false); }
                }}
            />
            {open && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
                    {options.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-slate-400 font-bold">ไม่พบพื้นที่ที่ค้นหา</div>
                    ) : options.map((n, i) => (
                        <button
                            key={n}
                            type="button"
                            onMouseDown={() => pick(n)}
                            onMouseEnter={() => setActive(i)}
                            className={`w-full text-left px-3 py-2 text-sm ${i === active ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700'} ${i ? 'border-t border-slate-100' : ''}`}
                        >
                            <span className="block">{n}</span>
                            {(() => {
                                const owners = ownersOf(n);
                                const fits = owners.some(o => placeSubs.includes(o));
                                return (
                                    <span className="block text-[11px] font-normal text-slate-400">
                                        ตาราง: {owners.join(', ') || '-'}
                                        {fits && <span className="ml-1 font-bold text-emerald-600">✓ ตรงกับเจ้าที่วิ่ง</span>}
                                    </span>
                                );
                            })()}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

interface Props {
    jobs: Job[];
    priceMatrix: PriceMatrix[];
    userName: string;
}

const PlaceAreaView: React.FC<Props> = ({ jobs, priceMatrix, userName }) => {
    const [version, setVersion] = useState<FuelRateVersion | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<Filter>('todo');
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    /** พื้นที่ที่กำลังแก้ ต่อสถานที่ — ยังไม่บันทึก */
    const [drafts, setDrafts] = useState<Record<string, string[]>>({});
    const [saving, setSaving] = useState<string | null>(null);
    const placeAreas = usePlaceAreas();

    useEffect(() => watchActiveFuelRates(
        v => { setVersion(v); setLoading(false); },
        () => { setVersion(null); setLoading(false); },
    ), []);

    const rows = version?.rows ?? [];
    const areaNames = useMemo(() => rateAreaNames(rows), [rows]);
    const ownersOf = useMemo(() => areaOwners(rows), [rows]);
    const stats = useMemo(
        () => buildPlaceStats(jobs, priceMatrix, rows, placeAreas.entries.map(e => e.place)),
        // placeAreas.version: รายการของทีมมาถึงทีหลัง ต้องคำนวณสถานะใหม่
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [jobs, priceMatrix, rows, placeAreas.version]
    );

    const teamAreas = (place: string) => placeAreas.entries.find(e => samePlace(e.place, place))?.areas ?? [];

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        return stats.filter(x => {
            if (s && !x.place.toLowerCase().includes(s)) return false;
            if (filter === 'todo') return x.status === 'none' && x.hasRateSub;
            if (filter === 'team') return x.areas.some(a => a.source === 'team');
            return true;
        });
    }, [stats, filter, q]);

    useEffect(() => { setPage(1); }, [filter, q]);
    const totalPages = pageCount(filtered.length, PAGE_SIZE);
    const safePage = Math.min(page, Math.max(totalPages, 1));
    const shown: PlaceStat[] = pageSlice(filtered, safePage, PAGE_SIZE);

    // เบาะแสคิดเฉพาะการ์ดในหน้านี้ (ทีละ 20) — คิดทั้ง 300 ที่ทุกครั้งจะหน่วงหน้าจอ
    const rateSubs = useMemo(() => new Set(rows.map(r => canonicalSubcontractor(r.company))), [rows]);
    // ผูกกับ "รายชื่อการ์ด" ไม่ใช่อาร์เรย์ shown — shown ถูกสร้างใหม่ทุก render
    // ถ้าผูกกับ shown จะคิดใหม่ทุกครั้งที่พิมพ์ในช่องค้นหา (20 การ์ด × ~20ms ต่อแป้น)
    const shownKey = shown.map(s => s.place).join('');
    const clues = useMemo(() => {
        const m = new Map<string, PlaceClues>();
        for (const s of shown) m.set(s.place, placeClues(s.place, jobs, rows, stats));
        return m;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shownKey, jobs, rows, stats, placeAreas.version]);

    const counts = useMemo(() => ({
        todo: stats.filter(x => x.status === 'none' && x.hasRateSub).length,
        team: stats.filter(x => x.areas.some(a => a.source === 'team')).length,
        all: stats.length,
    }), [stats]);

    const draftOf = (place: string) => drafts[place] ?? teamAreas(place);
    const setDraft = (place: string, areas: string[]) => setDrafts(d => ({ ...d, [place]: areas }));
    const addArea = (place: string, area: string) => {
        if (!area) return;
        const cur = draftOf(place);
        if (cur.some(a => samePlace(a, area))) return;
        setDraft(place, [...cur, area]);
    };
    const changed = (place: string) => {
        const a = [...draftOf(place)].sort().join('|');
        const b = [...teamAreas(place)].sort().join('|');
        return a !== b;
    };

    const handleSave = async (place: string) => {
        const areas = draftOf(place);
        const Swal = (window as any).Swal;
        const msg = areas.length
            ? `ยืนยันว่า "${place}" อยู่ในพื้นที่: ${areas.join(', ')} — มีผลกับการหาเรทและยอดปรับทันที`
            : `ลบการจับคู่ของ "${place}" ที่ทีมบันทึกไว้`;
        if (Swal) {
            const r = await Swal.fire({
                icon: 'question', title: 'ยืนยันการจับคู่', text: msg,
                showCancelButton: true, confirmButtonText: 'ยืนยัน', cancelButtonText: 'ยกเลิก',
                confirmButtonColor: '#4f46e5', customClass: { popup: 'rounded-[1.5rem]' },
            });
            if (!r.isConfirmed) return;
        } else if (!window.confirm(msg)) return;

        setSaving(place);
        try {
            await savePlaceArea(place, areas, userName);
            setDrafts(d => { const n = { ...d }; delete n[place]; return n; });
        } catch (e) {
            console.error('[PlaceArea] บันทึกไม่สำเร็จ:', e);
            const text = e instanceof Error ? e.message : String(e);
            if (Swal) Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text, confirmButtonColor: '#ef4444' });
            else alert('บันทึกไม่สำเร็จ: ' + text);
        } finally {
            setSaving(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 text-slate-400 gap-3">
                <Loader2 className="animate-spin" size={20} />
                <span className="text-sm font-bold">กำลังโหลดตารางเรท…</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-slate-900 rounded-[2rem] p-6 sm:p-8 text-white">
                <div className="flex items-center gap-4">
                    <div className="bg-white/10 rounded-2xl p-3"><MapPinned size={24} /></div>
                    <div>
                        <h1 className="text-2xl font-black">จับคู่สถานที่กับตารางเรท</h1>
                        <p className="text-[11px] font-bold tracking-[0.2em] text-slate-400 uppercase">Place → Rate Area</p>
                        <p className="text-sm text-slate-300 mt-1">
                            ตารางเรทเขียนพื้นที่กว้าง (เช่น กทม ปริมณฑล) · ใบงานและราคากลางเขียนชื่อร้าน
                        </p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row gap-3 sm:items-center">
                <div className="flex flex-wrap gap-2">
                    {([
                        ['todo', `ยังไม่จับคู่ (${counts.todo})`],
                        ['team', `ทีมจับคู่แล้ว (${counts.team})`],
                        ['all', `ทั้งหมด (${counts.all})`],
                    ] as [Filter, string][]).map(([k, label]) => (
                        <button
                            key={k}
                            onClick={() => setFilter(k)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filter === k ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <div className="relative sm:ml-auto sm:w-72">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={q}
                        onChange={e => setQ(e.target.value)}
                        placeholder="ค้นหาชื่อสถานที่"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500"
                    />
                </div>
            </div>

            {filter === 'todo' && (
                <p className="text-xs text-slate-500 -mt-3 px-1">
                    แสดงเฉพาะสถานที่ที่มีงานของผู้รับเหมาที่มีตารางเรท — สถานที่ของเจ้าที่ไม่มีเรท จับคู่ไปก็ไม่มีผล
                </p>
            )}

            <div className="space-y-3">
                {shown.map(s => {
                    const draft = draftOf(s.place);
                    const codeAreas = s.areas.filter(a => a.source === 'code');
                    const chip = STATUS_CHIP[s.status];
                    return (
                        <div key={s.place} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                            <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                                <p className="font-black text-slate-900 break-words min-w-0">{s.place}</p>
                                <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${chip.cls}`}>{chip.label}</span>
                                <span className="text-xs text-slate-500 sm:ml-auto tabular-nums">
                                    ใบงาน {s.trips.toLocaleString('th-TH')} ครั้ง · ราคากลาง {s.priceRows} เส้น
                                </span>
                            </div>

                            {s.subs.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                                    <span>ผู้รับเหมาที่วิ่ง:</span>
                                    {s.subs.slice(0, 5).map(x => (
                                        <span key={x.name} className="inline-flex items-center gap-1">
                                            {x.name} ({x.count})
                                            {!rateSubs.has(x.name) && (
                                                <span className="px-1.5 rounded bg-slate-100 text-slate-500 text-[10px] font-bold">ไม่มีตารางเรท</span>
                                            )}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {s.subs.length > 0 && s.subs.every(x => !rateSubs.has(x.name)) && (
                                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                    ผู้รับเหมาที่วิ่งร้านนี้ไม่มีตารางเรทเลย — จับคู่ไปก็ไม่มีผล จนกว่าหน่วยงานจะทำเรทให้เจ้าเหล่านี้
                                </p>
                            )}

                            {clues.get(s.place) && (() => {
                                const c = clues.get(s.place)!;
                                const empty = !c.routes.length && !c.candidates.length && !c.similar.length;
                                if (empty) return null;
                                return (
                                    <details open={s.status === 'none'} className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-600">
                                        <summary className="cursor-pointer font-bold text-slate-700">เบาะแสประกอบการตัดสินใจ</summary>
                                        <div className="mt-2 space-y-3">
                                            {c.routes.length > 0 && (
                                                <div>
                                                    <p className="font-bold text-slate-500 mb-1">เส้นทางที่วิ่งบ่อย (ใบงาน)</p>
                                                    <ul className="space-y-0.5">
                                                        {c.routes.map((r, i) => (
                                                            <li key={i} className="break-words">
                                                                {r.side === 'origin' ? <>ร้านนี้ → <b>{r.other || '-'}</b></> : <><b>{r.other || '-'}</b> → ร้านนี้</>}
                                                                {' · '}{r.truck || '-'} · {r.sub || '-'} · {r.count} ครั้ง
                                                                {r.costs.length > 0 && <> · จ่าย {r.costs.map(x => x.toLocaleString('th-TH')).join(' / ')} บาท</>}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {c.candidates.length > 0 && (
                                                <div>
                                                    <p className="font-bold text-slate-500 mb-1">
                                                        พื้นที่ที่เป็นไปได้ — แถวในตารางของเจ้าเดียวกันที่ปลายอีกด้านตรงกัน (กดเพื่อเพิ่ม)
                                                    </p>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {c.candidates.map(x => (
                                                            <button
                                                                key={`${x.area}|${x.sub}`}
                                                                onClick={() => addArea(s.place, x.area)}
                                                                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-left"
                                                            >
                                                                <b className="text-slate-800">{x.area}</b>
                                                                <span className="text-slate-500">
                                                                    {' · '}ตาราง {x.sub} · ราคาตรงพอดี {x.exactPrice}/{x.support} ใบ
                                                                    {x.nearestDiff !== null && x.exactPrice < x.support && <> · ใกล้สุดต่าง {x.nearestDiff.toLocaleString('th-TH')} บาท</>}
                                                                </span>
                                                                {x.nameMatch && <span className="ml-1 font-bold text-emerald-600">ชื่อสอดคล้อง</span>}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {c.similar.length > 0 && (
                                                <div>
                                                    <p className="font-bold text-slate-500 mb-1">ชื่อคล้ายกัน</p>
                                                    <ul className="space-y-0.5">
                                                        {c.similar.map(x => (
                                                            <li key={x.name} className="break-words">
                                                                {x.inTable ? (
                                                                    <button onClick={() => addArea(s.place, x.name)} className="font-bold text-indigo-700 hover:underline">
                                                                        {x.name}
                                                                    </button>
                                                                ) : <b>{x.name}</b>}
                                                                {x.inTable && <span className="text-slate-400"> (ชื่อในตารางเรท — กดเพื่อเพิ่ม)</span>}
                                                                {x.areas.length > 0 && <span> → จับคู่ไว้กับ {x.areas.join(', ')}</span>}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    </details>
                                );
                            })()}

                            {codeAreas.length > 0 && (
                                <p className="text-xs text-slate-500">
                                    ยืนยันในระบบแล้ว: {codeAreas.map(a => a.area).join(', ')}
                                </p>
                            )}

                            {s.suggestions.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
                                        <Lightbulb size={14} /> ระบบแนะนำ:
                                    </span>
                                    {s.suggestions.slice(0, 3).map(sg => {
                                        // หลักฐานชิ้นเดียวมักเป็นราคาบังเอิญตรง (เช่น สมุทรสงคราม → เขตพิจิตร)
                                        const weak = sg.fromPrice + sg.fromJobs < 2;
                                        return (
                                            <button
                                                key={sg.area}
                                                onClick={() => addArea(s.place, sg.area)}
                                                className={`px-2.5 py-1 rounded-lg border text-xs ${weak
                                                    ? 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                                                    : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'}`}
                                                title="กดเพื่อเพิ่ม — ต้องกดบันทึกอีกครั้ง"
                                            >
                                                {sg.area} · ราคากลาง {sg.fromPrice} · ใบงาน {sg.fromJobs}
                                                {weak && ' · หลักฐานน้อย'}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {draft.length > 0 && (
                                <div className="flex flex-wrap items-start gap-2">
                                    {draft.map(a => {
                                        // ระบบจับคู่เรทของผู้รับเหมาเจ้าเดียวกันเท่านั้น — พื้นที่ที่ไม่อยู่ในตาราง
                                        // ของเจ้าที่วิ่งร้านนี้ จับคู่ไปก็หาเรทไม่เจอ
                                        const owners = ownersOf(a);
                                        const noEffect = s.subs.length > 0 && !owners.some(o => s.subs.some(x => x.name === o));
                                        return (
                                            <span
                                                key={a}
                                                className={`inline-flex flex-col px-2.5 py-1 rounded-lg text-xs font-bold ${noEffect ? 'bg-orange-50 text-orange-700 border border-orange-200' : 'bg-indigo-50 text-indigo-700'}`}
                                            >
                                                <span className="inline-flex items-center gap-1">
                                                    {noEffect && <AlertTriangle size={12} />}
                                                    {a}
                                                    <button onClick={() => setDraft(s.place, draft.filter(x => x !== a))} aria-label={`เอา ${a} ออก`}>
                                                        <X size={12} />
                                                    </button>
                                                </span>
                                                {noEffect && (
                                                    <span className="font-normal text-[11px]">
                                                        จับคู่แล้วจะไม่มีผล — พื้นที่นี้อยู่ในตาราง {owners.join(', ') || '-'} แต่ร้านนี้วิ่งโดย {s.subs.slice(0, 3).map(x => x.name).join(', ')}
                                                    </span>
                                                )}
                                            </span>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="flex flex-wrap items-center gap-2">
                                <AreaPicker
                                    names={areaNames}
                                    exclude={draft}
                                    label={`พื้นที่ในตารางเรทของ ${s.place}`}
                                    onPick={area => addArea(s.place, area)}
                                    ownersOf={ownersOf}
                                    placeSubs={s.subs.map(x => x.name)}
                                />
                                {changed(s.place) && (
                                    <button
                                        onClick={() => handleSave(s.place)}
                                        disabled={saving === s.place}
                                        className="ml-auto px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black flex items-center gap-1 disabled:bg-slate-400"
                                    >
                                        {saving === s.place ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                        บันทึก
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
                {!shown.length && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-sm font-bold">
                        ไม่มีรายการ
                    </div>
                )}
            </div>

            {totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {buildPageNumbers(totalPages, safePage).map((p, i) =>
                        p === null ? (
                            <span key={`gap-${i}`} className="px-2 text-slate-400">…</span>
                        ) : (
                            <button
                                key={p}
                                onClick={() => setPage(p as number)}
                                className={`min-w-9 h-9 px-2 rounded-lg text-sm font-bold ${p === safePage ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                                {p}
                            </button>
                        )
                    )}
                </div>
            )}

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex gap-3">
                <Info className="text-slate-400 shrink-0 mt-0.5" size={18} />
                <div className="text-xs text-slate-600 space-y-1">
                    <p><span className="font-bold">จับคู่เฉพาะที่มั่นใจ</span> — ถ้าจับคู่ผิด ระบบจะคิดค่าขนส่งด้วยเรทของพื้นที่อื่น</p>
                    <p>คำแนะนำมาจากราคากลางและค่าขนส่งในใบงานที่ตรงกับราคาของเส้นทางเดียวในตาราง เป็นแค่ข้อมูลประกอบ</p>
                    <p>ระบบใช้ชื่อตรงก่อนเสมอ การจับคู่พื้นที่ใช้เมื่อหาชื่อตรงไม่เจอ · หน้านี้ไม่แก้ใบงานและราคากลาง</p>
                </div>
            </div>
        </div>
    );
};

export default PlaceAreaView;
