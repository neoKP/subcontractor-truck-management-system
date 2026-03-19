import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, pdf, Image } from '@react-pdf/renderer';
import { Job } from '../types';
import { formatDate, formatThaiCurrency } from '../utils/format';
import { initPDFResources } from './JobRequestPDF';

const FONT_FAMILY = 'Sarabun_Thai_Fixed';

const t = (text: string | number | undefined | null) => {
    if (text === undefined || text === null) return '-';
    return `${text}  `;
};

const s = StyleSheet.create({
    page: {
        paddingTop: '15mm',
        paddingBottom: '15mm',
        paddingLeft: '15mm',
        paddingRight: '15mm',
        fontFamily: FONT_FAMILY,
        fontSize: 10,
        color: '#1e293b',
        backgroundColor: '#ffffff',
    },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    companyName: { fontSize: 13, fontWeight: 700, marginBottom: 1 },
    companyNameEN: { fontSize: 8, fontWeight: 700, color: '#64748b', marginBottom: 3 },
    companyAddress: { fontSize: 8, color: '#64748b', lineHeight: 1.4 },
    logo: { width: 90, height: 'auto' },
    divider: { borderBottomWidth: 2, borderBottomColor: '#0f172a', marginBottom: 10 },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    titleMain: { fontSize: 18, fontWeight: 700 },
    titleSub: { fontSize: 8, fontWeight: 700, color: '#94a3b8' },
    docInfoBox: { borderLeftWidth: 3, borderLeftColor: '#0f172a', paddingLeft: 8, paddingVertical: 2, width: 200 },
    docInfoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    docInfoLabel: { fontSize: 8, fontWeight: 700, color: '#64748b' },
    docInfoValue: { fontSize: 9, fontWeight: 700 },
    // Payee box
    payeeRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    payeeBox: { flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', padding: 8, borderRadius: 2 },
    payeeLabel: { fontSize: 7, fontWeight: 700, color: '#94a3b8', marginBottom: 3 },
    payeeValue: { fontSize: 10, fontWeight: 700 },
    payeeSmall: { fontSize: 7.5, color: '#475569', lineHeight: 1.4, marginTop: 2 },
    // Table
    tableHeader: { flexDirection: 'row', backgroundColor: '#1e293b', paddingVertical: 5 },
    tableHeaderText: { color: '#ffffff', fontSize: 8, fontWeight: 700, textAlign: 'center' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0', minHeight: 26 },
    tableRowAlt: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0', minHeight: 26, backgroundColor: '#f8fafc' },
    cellNo: { width: 28, padding: 4, textAlign: 'center', fontSize: 8, color: '#94a3b8', justifyContent: 'center' },
    cellDesc: { flex: 1, padding: 4, fontSize: 8, justifyContent: 'center' },
    cellQty: { width: 42, padding: 4, textAlign: 'center', fontSize: 8, justifyContent: 'center' },
    cellPrice: { width: 80, padding: 4, textAlign: 'right', fontSize: 8, justifyContent: 'center' },
    cellTotal: { width: 80, padding: 4, textAlign: 'right', fontSize: 8, fontWeight: 700, justifyContent: 'center' },
    descMain: { fontSize: 8.5, fontWeight: 700, marginBottom: 1 },
    descSub: { fontSize: 7, color: '#64748b' },
    // Summary
    summaryDivider: { borderTopWidth: 2, borderTopColor: '#0f172a', marginTop: 8, paddingTop: 10 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 30 },
    summaryLeft: { flex: 1 },
    summaryRight: { width: 220 },
    sumLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
    sumLabel: { fontSize: 9, color: '#64748b' },
    sumValue: { fontSize: 9, fontWeight: 700 },
    sumLabelBold: { fontSize: 9, fontWeight: 700, color: '#64748b' },
    whtLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
    whtLabel: { fontSize: 9, color: '#dc2626' },
    whtValue: { fontSize: 9, fontWeight: 700, color: '#dc2626' },
    netBox: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 2, borderTopColor: '#0f172a', marginTop: 4, paddingTop: 6, backgroundColor: '#f8fafc', padding: 6, borderRadius: 2 },
    netLabel: { fontSize: 9, fontWeight: 700, color: '#1e40af' },
    netValue: { fontSize: 11, fontWeight: 700, color: '#1e40af', textDecoration: 'underline' },
    bahtTextBox: { backgroundColor: '#0f172a', padding: 6, borderRadius: 2, alignItems: 'center', marginTop: 6 },
    bahtTextValue: { fontSize: 8, fontWeight: 700, color: '#ffffff' },
    // WHT box
    whtBox: { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', padding: 6, borderRadius: 2, marginTop: 8 },
    whtBoxTitle: { fontSize: 8, fontWeight: 700, color: '#c2410c', marginBottom: 4 },
    whtRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    whtSmallLabel: { fontSize: 7.5, color: '#9a3412' },
    whtSmallValue: { fontSize: 7.5, fontWeight: 700, color: '#9a3412' },
    // Bank info
    bankBox: { backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', padding: 6, borderRadius: 2, marginBottom: 6 },
    bankTitle: { fontSize: 8, fontWeight: 700, color: '#0369a1', marginBottom: 4 },
    bankRow: { flexDirection: 'row', marginBottom: 2 },
    bankLabel: { fontSize: 7.5, color: '#0369a1', width: 90 },
    bankValue: { fontSize: 7.5, fontWeight: 700, color: '#0c4a6e', flex: 1 },
    // Remarks
    remarksBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', padding: 6, borderRadius: 2, marginBottom: 6, minHeight: 40 },
    remarksLabel: { fontSize: 7, fontWeight: 700, color: '#94a3b8', marginBottom: 3 },
    remarksText: { fontSize: 8, color: '#64748b', lineHeight: 1.4 },
    // Signatures
    signatureSection: { marginTop: 'auto', paddingTop: 20 },
    signatureRow: { flexDirection: 'row', gap: 30 },
    signatureBox: { flex: 1, alignItems: 'center' },
    signatureLine: { width: '100%', borderBottomWidth: 1, borderBottomColor: '#cbd5e1', marginBottom: 6, height: 35 },
    signatureTitle: { fontSize: 9, fontWeight: 700, textAlign: 'center' },
    signatureDate: { fontSize: 8, color: '#94a3b8', textAlign: 'center', marginTop: 2 },
    pageNumber: { position: 'absolute', bottom: 8, right: 15, fontSize: 8, fontWeight: 700, color: '#64748b' },
});

const bahtText = (num: number): string => {
    if (!num || num <= 0) return 'ศูนย์บาทถ้วน';
    const ThaiNumber = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
    const ThaiUnit = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
    const read = (nStr: string): string => {
        let res = '';
        for (let i = 0; i < nStr.length; i++) {
            const digit = parseInt(nStr[i]);
            const pos = nStr.length - i - 1;
            if (digit !== 0) {
                if (pos === 1 && digit === 1) res += '';
                else if (pos === 1 && digit === 2) res += 'ยี่';
                else if (pos === 0 && digit === 1 && nStr.length > 1) res += 'เอ็ด';
                else res += ThaiNumber[digit];
                res += ThaiUnit[pos];
            }
        }
        return res;
    };
    const convert = (numStr: string): string => {
        let res = ''; const parts = []; let sx = numStr;
        while (sx.length > 0) { parts.push(sx.slice(-6)); sx = sx.slice(0, -6); }
        for (let i = parts.length - 1; i >= 0; i--) { res += read(parts[i]); if (i > 0) res += 'ล้าน'; }
        return res;
    };
    const str = num.toFixed(2);
    const [intPart, decPart] = str.split('.');
    const intNum = parseInt(intPart);
    const decNum = parseInt(decPart);
    let result = '';
    if (intNum > 0) result += convert(intPart) + 'บาท';
    if (decNum > 0) result += convert(decPart) + 'สตางค์';
    else if (intNum > 0) result += 'ถ้วน';
    return result;
};

export interface PaymentVoucherProps {
    job: Job;
    documentNumber: string;
    currentDate: string;
    whtRate: number;
    logoUrl?: string | null;
}

const PaymentVoucherDocument: React.FC<PaymentVoucherProps> = ({
    job, documentNumber, currentDate, whtRate, logoUrl
}) => {
    const totalCost = (job.cost || 0) + (job.extraCharge || 0);
    const whtAmount = Math.round((totalCost * whtRate) / 100 * 100) / 100;
    const netAmount = totalCost - whtAmount;

    const route = job.origin && job.destination ? `${job.origin} → ${job.destination}` : '-';
    const plate = job.licensePlate ? ` (${job.licensePlate})` : '';
    const truck = job.truckType ? `${job.truckType}${plate}` : '-';

    return (
        <Document>
            <Page size="A4" style={s.page}>
                {/* Header */}
                <View style={s.headerRow}>
                    <View>
                        <Text style={s.companyName}>{t('บริษัท นีโอสยาม โลจิสติกส์ จำกัด')}</Text>
                        <Text style={s.companyNameEN}>{t('NEO SIAM LOGISTICS CO., LTD.')}</Text>
                        <Text style={s.companyAddress}>{t('เลขที่ผู้เสียภาษี: 0105567012345')}</Text>
                        <Text style={s.companyAddress}>{t('โทร: 02-xxx-xxxx  |  อีเมล: info@neosiam.co.th')}</Text>
                    </View>
                    {logoUrl ? (
                        <Image src={logoUrl} style={s.logo} />
                    ) : (
                        <View style={{ width: 90 }} />
                    )}
                </View>
                <View style={s.divider} />

                {/* Title + Doc Info */}
                <View style={s.titleRow}>
                    <View>
                        <Text style={s.titleMain}>{t('ใบสำคัญจ่าย')}</Text>
                        <Text style={s.titleSub}>{t('PAYMENT VOUCHER')}</Text>
                    </View>
                    <View style={s.docInfoBox}>
                        <View style={s.docInfoRow}>
                            <Text style={s.docInfoLabel}>{t('เลขที่:')}</Text>
                            <Text style={s.docInfoValue}>{t(documentNumber)}</Text>
                        </View>
                        <View style={s.docInfoRow}>
                            <Text style={s.docInfoLabel}>{t('วันที่:')}</Text>
                            <Text style={s.docInfoValue}>{t(currentDate)}</Text>
                        </View>
                        <View style={s.docInfoRow}>
                            <Text style={s.docInfoLabel}>{t('อ้างอิง Job:')}</Text>
                            <Text style={s.docInfoValue}>{t(job.id)}</Text>
                        </View>
                        <View style={s.docInfoRow}>
                            <Text style={s.docInfoLabel}>{t('วันที่บริการ:')}</Text>
                            <Text style={s.docInfoValue}>{t(formatDate(job.dateOfService))}</Text>
                        </View>
                    </View>
                </View>

                {/* Payee Info */}
                <View style={s.payeeRow}>
                    <View style={s.payeeBox}>
                        <Text style={s.payeeLabel}>{t('จ่ายให้ / PAY TO')}</Text>
                        <Text style={s.payeeValue}>{t(job.subcontractor)}</Text>
                        <Text style={s.payeeSmall}>{t(`คนขับ: ${job.driverName || '-'}  |  โทร: ${job.driverPhone || '-'}`)}</Text>
                        <Text style={s.payeeSmall}>{t(`รถ: ${truck}`)}</Text>
                    </View>
                    <View style={s.payeeBox}>
                        <Text style={s.payeeLabel}>{t('เลขประจำตัวผู้เสียภาษี / TAX ID')}</Text>
                        <Text style={s.payeeValue}>{t(job.taxId || '-')}</Text>
                        <Text style={s.payeeSmall}>{t(`เส้นทาง: ${route}`)}</Text>
                        <Text style={s.payeeSmall}>{t(`วันที่เสร็จงาน: ${formatDate(job.actualArrivalTime)}`)}</Text>
                    </View>
                </View>

                {/* Table */}
                <View style={s.tableHeader}>
                    <Text style={[s.tableHeaderText, s.cellNo]}>{t('#')}</Text>
                    <Text style={[s.tableHeaderText, s.cellDesc]}>{t('รายละเอียด / Description')}</Text>
                    <Text style={[s.tableHeaderText, s.cellQty]}>{t('จำนวน')}</Text>
                    <Text style={[s.tableHeaderText, s.cellPrice]}>{t('ราคา/หน่วย')}</Text>
                    <Text style={[s.tableHeaderText, s.cellTotal]}>{t('รวม')}</Text>
                </View>

                <View style={s.tableRow}>
                    <Text style={[s.cellNo, { fontSize: 8, textAlign: 'center', paddingTop: 6 }]}>{t('1')}</Text>
                    <View style={s.cellDesc}>
                        <Text style={s.descMain}>{t(`ค่าขนส่ง - ${route}`)}</Text>
                        <Text style={s.descSub}>{t(`${truck}  |  ${formatDate(job.dateOfService)}`)}</Text>
                    </View>
                    <Text style={[s.cellQty, { paddingTop: 6 }]}>{t('1')}</Text>
                    <Text style={[s.cellPrice, { paddingTop: 6 }]}>{t(`฿${formatThaiCurrency(job.cost || 0)}`)}</Text>
                    <Text style={[s.cellTotal, { paddingTop: 6 }]}>{t(`฿${formatThaiCurrency(job.cost || 0)}`)}</Text>
                </View>

                {(job.extraCharge || 0) > 0 && (
                    <View style={s.tableRowAlt}>
                        <Text style={[s.cellNo, { fontSize: 8, textAlign: 'center', paddingTop: 6 }]}>{t('2')}</Text>
                        <View style={s.cellDesc}>
                            <Text style={s.descMain}>{t('ค่าใช้จ่ายพิเศษ (Extra Charges)')}</Text>
                        </View>
                        <Text style={[s.cellQty, { paddingTop: 6 }]}>{t('1')}</Text>
                        <Text style={[s.cellPrice, { paddingTop: 6 }]}>{t(`฿${formatThaiCurrency(job.extraCharge || 0)}`)}</Text>
                        <Text style={[s.cellTotal, { paddingTop: 6 }]}>{t(`฿${formatThaiCurrency(job.extraCharge || 0)}`)}</Text>
                    </View>
                )}

                {/* Summary */}
                <View style={s.summaryDivider}>
                    <View style={s.summaryRow}>
                        {/* Left: Bank Info + Remarks */}
                        <View style={s.summaryLeft}>
                            <View style={s.bankBox}>
                                <Text style={s.bankTitle}>{t(`🏦 ข้อมูลการชำระเงิน / Payment Details${job.paymentType === 'CASH' ? '  (💵 เงินสด)' : '  (📅 เครดิต)'}`)}</Text>
                                {job.paymentType === 'CASH' ? (
                                    <View style={s.bankRow}>
                                        <Text style={s.bankLabel}>{t('บัญชีที่ชำระ:')}</Text>
                                        <Text style={[s.bankValue, { flex: 1 }]}>{t(job.paymentAccount || '-')}</Text>
                                    </View>
                                ) : (
                                    <>
                                        <View style={s.bankRow}>
                                            <Text style={s.bankLabel}>{t('ธนาคาร:')}</Text>
                                            <Text style={s.bankValue}>{t(job.bankName || '-')}</Text>
                                        </View>
                                        <View style={s.bankRow}>
                                            <Text style={s.bankLabel}>{t('ชื่อบัญชี:')}</Text>
                                            <Text style={s.bankValue}>{t(job.bankAccountName || '-')}</Text>
                                        </View>
                                        <View style={s.bankRow}>
                                            <Text style={s.bankLabel}>{t('เลขที่บัญชี:')}</Text>
                                            <Text style={s.bankValue}>{t(job.bankAccountNo || '-')}</Text>
                                        </View>
                                    </>
                                )}
                            </View>

                            <View style={s.whtBox}>
                                <Text style={s.whtBoxTitle}>{t(`📋 หนังสือรับรองหัก ณ ที่จ่าย (WHT ${whtRate}%)`)}</Text>
                                <View style={s.whtRow}>
                                    <Text style={s.whtSmallLabel}>{t('ประเภทเงินได้:')}</Text>
                                    <Text style={s.whtSmallValue}>{t('40(8) ค่าขนส่ง')}</Text>
                                </View>
                                <View style={s.whtRow}>
                                    <Text style={s.whtSmallLabel}>{t('เงินได้ที่จ่าย:')}</Text>
                                    <Text style={s.whtSmallValue}>{t(`฿${formatThaiCurrency(totalCost)}`)}</Text>
                                </View>
                                <View style={s.whtRow}>
                                    <Text style={s.whtSmallLabel}>{t(`ภาษีหัก ณ ที่จ่าย ${whtRate}%:`)}</Text>
                                    <Text style={s.whtSmallValue}>{t(`฿${formatThaiCurrency(whtAmount)}`)}</Text>
                                </View>
                            </View>

                            <View style={s.remarksBox}>
                                <Text style={s.remarksLabel}>{t('หมายเหตุ / Remarks')}</Text>
                                <Text style={s.remarksText}>{t(job.remark || '-')}</Text>
                            </View>
                        </View>

                        {/* Right: Amount Summary */}
                        <View style={s.summaryRight}>
                            <View style={s.sumLine}>
                                <Text style={s.sumLabel}>{t('รวมเงิน (Subtotal):')}</Text>
                                <Text style={s.sumValue}>{t(`฿${formatThaiCurrency(totalCost)}`)}</Text>
                            </View>
                            <View style={s.sumLine}>
                                <Text style={[s.whtLabel, { fontSize: 9 }]}>{t(`หัก ณ ที่จ่าย ${whtRate}%:`)}</Text>
                                <Text style={[s.whtValue, { fontSize: 9 }]}>{t(`-฿${formatThaiCurrency(whtAmount)}`)}</Text>
                            </View>
                            <View style={s.netBox}>
                                <View>
                                    <Text style={s.netLabel}>{t('ยอดสุทธิ (NET TOTAL)')}</Text>
                                    <Text style={{ fontSize: 7, color: '#1e40af' }}>{t('NET TOTAL (After WHT)')}</Text>
                                </View>
                                <Text style={s.netValue}>{t(`฿${formatThaiCurrency(netAmount)}`)}</Text>
                            </View>
                            <View style={s.bahtTextBox}>
                                <Text style={s.bahtTextValue}>{t(bahtText(netAmount))}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Signatures */}
                <View style={s.signatureSection}>
                    <View style={s.signatureRow}>
                        <View style={s.signatureBox}>
                            <View style={s.signatureLine} />
                            <Text style={s.signatureTitle}>{t('ผู้รับเงิน / Payee')}</Text>
                            <Text style={s.signatureDate}>{t(`วันที่ / Date: ___/___/______`)}</Text>
                        </View>
                        <View style={s.signatureBox}>
                            <View style={s.signatureLine} />
                            <Text style={s.signatureTitle}>{t('ผู้ตรวจสอบ / Verified by')}</Text>
                            <Text style={s.signatureDate}>{t(`วันที่ / Date: ___/___/______`)}</Text>
                        </View>
                        <View style={s.signatureBox}>
                            <View style={s.signatureLine} />
                            <Text style={s.signatureTitle}>{t('ผู้อนุมัติ / Authorized by')}</Text>
                            <Text style={s.signatureDate}>{t(`วันที่ / Date: ___/___/______`)}</Text>
                        </View>
                    </View>
                </View>

                <Text style={s.pageNumber} render={({ pageNumber, totalPages }) => t(`หน้า ${pageNumber} จาก ${totalPages}`)} fixed />
            </Page>
        </Document>
    );
};

// ── Generate PDF Blob ─────────────────────────────────────────────────────────
let logoUrlCache: string | null = null;
const ensureLogo = async () => {
    if (logoUrlCache) return;
    try {
        const base = typeof window !== 'undefined' ? window.location.origin : '';
        const res = await fetch(`${base}/logo.png`);
        if (res.ok) { const blob = await res.blob(); logoUrlCache = URL.createObjectURL(blob); }
    } catch { /* ignore */ }
};

export interface GeneratePaymentVoucherOptions {
    job: Job;
    whtRate?: number;
}

const buildDocProps = (job: Job, whtRate: number): PaymentVoucherProps => {
    const now = new Date();
    const docNo = `PV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${job.id.split('-').pop() || job.id}`;
    const dateStr = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    return { job, documentNumber: docNo, currentDate: dateStr, whtRate, logoUrl: logoUrlCache };
};

export const generatePaymentVoucherBlob = async ({ job, whtRate = 1 }: GeneratePaymentVoucherOptions): Promise<Blob> => {
    await initPDFResources();
    await ensureLogo();
    const props = buildDocProps(job, whtRate);
    return await pdf(<PaymentVoucherDocument {...props} />).toBlob();
};

export const downloadPaymentVoucher = async (options: GeneratePaymentVoucherOptions): Promise<void> => {
    const blob = await generatePaymentVoucherBlob(options);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PaymentVoucher-${options.job.id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
};

export default PaymentVoucherDocument;
