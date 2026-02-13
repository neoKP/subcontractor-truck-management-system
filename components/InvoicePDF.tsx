import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, pdf, Image } from '@react-pdf/renderer';
import { Job } from '../types';
import { formatDate, formatThaiCurrency, roundHalfUp } from '../utils/format';
import { initPDFResources } from './JobRequestPDF';

const FONT_FAMILY = 'Sarabun_Thai_Fixed';

// Helper to prevent Thai glyph clipping
const t = (text: string | number | undefined | null) => {
    if (text === undefined || text === null) return '-';
    return `${text}  `;
};

/**
 * Converts number to Thai Baht text
 */
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
        let res = '';
        const parts = [];
        let s = numStr;
        while (s.length > 0) {
            parts.push(s.slice(-6));
            s = s.slice(0, -6);
        }
        for (let i = parts.length - 1; i >= 0; i--) {
            res += read(parts[i]);
            if (i > 0) res += 'ล้าน';
        }
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
    else if (decNum === 0 && intNum === 0) return 'ศูนย์บาทถ้วน';
    else if (intNum === 0 && decNum > 0) result = convert(decPart) + 'สตางค์';
    return result;
};

// Get logoUrl from JobRequestPDF's shared resource
let logoUrl: string | null = null;

const ensureLogo = async () => {
    if (logoUrl) return;
    try {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const res = await fetch(`${baseUrl}/logo.png`);
        if (res.ok) {
            const blob = await res.blob();
            logoUrl = URL.createObjectURL(blob);
        }
    } catch { /* ignore */ }
};

// Styles
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
    // Header
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    companyName: { fontSize: 13, fontWeight: 700, marginBottom: 1 },
    companyNameEN: { fontSize: 8, fontWeight: 700, color: '#64748b', marginBottom: 3 },
    companyAddress: { fontSize: 8, color: '#64748b', lineHeight: 1.4 },
    logo: { width: 90, height: 'auto' },
    divider: { borderBottomWidth: 2, borderBottomColor: '#0f172a', marginBottom: 10 },
    // Title
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    titleMain: { fontSize: 18, fontWeight: 700 },
    titleSub: { fontSize: 8, fontWeight: 700, color: '#94a3b8' },
    // Doc info
    docInfoBox: { borderLeftWidth: 3, borderLeftColor: '#0f172a', paddingLeft: 8, paddingVertical: 2, width: 200 },
    docInfoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    docInfoLabel: { fontSize: 8, fontWeight: 700, color: '#64748b' },
    docInfoValue: { fontSize: 9, fontWeight: 700 },
    docInfoValueRed: { fontSize: 9, fontWeight: 700, color: '#dc2626' },
    docInfoValueBlue: { fontSize: 9, fontWeight: 700, color: '#1d4ed8' },
    // Subcon info
    subconRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    subconBox: { flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', padding: 6, borderRadius: 2 },
    subconLabel: { fontSize: 7, fontWeight: 700, color: '#94a3b8', marginBottom: 2 },
    subconValue: { fontSize: 10, fontWeight: 700 },
    subconSmall: { fontSize: 7, color: '#64748b', lineHeight: 1.3 },
    // Table
    tableHeader: { flexDirection: 'row', backgroundColor: '#1e293b', paddingVertical: 5 },
    tableHeaderText: { color: '#ffffff', fontSize: 8, fontWeight: 700, textAlign: 'center' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0', minHeight: 28 },
    tableRowAlt: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0', minHeight: 28, backgroundColor: '#f8fafc' },
    tableRowExtra: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0', minHeight: 20, backgroundColor: '#fefce8' },
    cellNo: { width: 28, padding: 4, textAlign: 'center', fontSize: 8, color: '#94a3b8', justifyContent: 'center' },
    cellDesc: { flex: 1, padding: 4, fontSize: 8, justifyContent: 'center' },
    cellQty: { width: 42, padding: 4, textAlign: 'center', fontSize: 8, justifyContent: 'center' },
    cellPrice: { width: 70, padding: 4, textAlign: 'right', fontSize: 8, justifyContent: 'center' },
    cellTotal: { width: 70, padding: 4, textAlign: 'right', fontSize: 8, fontWeight: 700, justifyContent: 'center' },
    descMain: { fontSize: 8.5, fontWeight: 700, marginBottom: 1 },
    descDrops: { fontSize: 7, color: '#7c3aed', marginBottom: 1 },
    descSub: { fontSize: 7, color: '#64748b' },
    extraText: { fontSize: 7.5, color: '#64748b', fontStyle: 'italic' },
    // Summary
    summaryDivider: { borderTopWidth: 2, borderTopColor: '#0f172a', marginTop: 8, paddingTop: 10 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 30 },
    summaryLeft: { flex: 1 },
    summaryRight: { width: 200 },
    remarksBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', padding: 6, borderRadius: 2, marginBottom: 6, minHeight: 50 },
    remarksLabel: { fontSize: 7, fontWeight: 700, color: '#94a3b8', marginBottom: 3 },
    remarksText: { fontSize: 8, color: '#64748b', fontStyle: 'italic', lineHeight: 1.4 },
    bahtTextBox: { backgroundColor: '#0f172a', padding: 6, borderRadius: 2, alignItems: 'center' },
    bahtTextValue: { fontSize: 8, fontWeight: 700, color: '#ffffff' },
    sumLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
    sumLabel: { fontSize: 9, fontWeight: 700, color: '#64748b' },
    sumValue: { fontSize: 9, fontWeight: 700 },
    netBox: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 2, borderTopColor: '#0f172a', marginTop: 4, paddingTop: 6, backgroundColor: '#f8fafc', padding: 6, borderRadius: 2 },
    netLabel: { fontSize: 9, fontWeight: 700, color: '#1e40af' },
    netLabelSub: { fontSize: 7, fontWeight: 700, color: '#1e40af' },
    netValue: { fontSize: 11, fontWeight: 700, color: '#1e40af', textDecoration: 'underline' },
    // Signatures
    signatureSection: { marginTop: 'auto', paddingTop: 20 },
    signatureRow: { flexDirection: 'row', gap: 40 },
    signatureBox: { flex: 1, alignItems: 'center' },
    signatureLine: { width: '100%', borderBottomWidth: 1, borderBottomColor: '#cbd5e1', marginBottom: 6, height: 30 },
    signatureTitle: { fontSize: 9, fontWeight: 700, textAlign: 'center' },
    signatureDate: { fontSize: 8, color: '#94a3b8', textAlign: 'center', marginTop: 2 },
    // Footer
    pageNumber: { position: 'absolute', bottom: 8, right: 15, fontSize: 8, fontWeight: 700, color: '#64748b' },
});

interface InvoicePDFProps {
    jobs: Job[];
    documentNumber: string;
    referenceNo: string;
    currentDate: string;
    dueDateStr: string;
    paymentTerms: { paymentType: string; creditDays: number };
    subtotal: number;
    vatAmount: number;
    whtAmount: number;
    netTotal: number;
    applyVat: boolean;
    applyWht: boolean;
    vatRate: number;
    whtRate: number;
}

const ITEMS_PER_PAGE = 10;

const InvoicePDFDocument: React.FC<InvoicePDFProps> = ({
    jobs, documentNumber, referenceNo, currentDate, dueDateStr,
    paymentTerms, subtotal, vatAmount, whtAmount, netTotal,
    applyVat, applyWht, vatRate, whtRate
}) => {
    const mainJob = jobs[0];
    const jobChunks: Job[][] = [];
    for (let i = 0; i < jobs.length; i += ITEMS_PER_PAGE) {
        jobChunks.push(jobs.slice(i, i + ITEMS_PER_PAGE));
    }
    const totalPages = jobChunks.length;

    return (
        <Document>
            {jobChunks.map((chunk, pageIndex) => (
                <Page key={pageIndex} size="A4" style={s.page}>
                    {/* Header */}
                    <View style={s.headerRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.companyName}>{t('บริษัท นีโอสยาม โลจิสติกส์ แอนด์ ทรานสปอร์ต จำกัด')}</Text>
                            <Text style={s.companyNameEN}>{t('NEOSIAM LOGISTICS & TRANSPORT CO., LTD.')}</Text>
                            <Text style={s.companyAddress}>{t('159/9-10 หมู่ 7 ต.บางม่วง อ.เมืองนครสวรรค์ จ.นครสวรรค์ 60000')}</Text>
                            <Text style={s.companyAddress}>{t('Tax ID: 0105552087673 | Tel: 056-275-841')}</Text>
                        </View>
                        {logoUrl && <Image src={logoUrl} style={s.logo} />}
                    </View>
                    <View style={s.divider} />

                    {/* Title + Doc Info */}
                    <View style={s.titleRow}>
                        <View>
                            <Text style={s.titleMain}>{t('ใบรับวางบิล')}</Text>
                            <Text style={s.titleSub}>{t('Billing Acknowledgement')}</Text>
                        </View>
                        <View style={s.docInfoBox}>
                            <View style={s.docInfoRow}>
                                <Text style={s.docInfoLabel}>{t('เลขที่ No:')}</Text>
                                <Text style={s.docInfoValue}>{t(documentNumber)}</Text>
                            </View>
                            <View style={s.docInfoRow}>
                                <Text style={s.docInfoLabel}>{t('เอกสารอ้างอิง Ref:')}</Text>
                                <Text style={s.docInfoValueRed}>{t(referenceNo || '________________')}</Text>
                            </View>
                            <View style={s.docInfoRow}>
                                <Text style={s.docInfoLabel}>{t('วันที่ Date:')}</Text>
                                <Text style={s.docInfoValue}>{t(currentDate)}</Text>
                            </View>
                            <View style={s.docInfoRow}>
                                <Text style={s.docInfoLabel}>{t('กำหนด Due:')}</Text>
                                <Text style={s.docInfoValueBlue}>{t(dueDateStr)}</Text>
                            </View>
                            <View style={[s.docInfoRow, { borderTopWidth: 0.5, borderTopColor: '#e2e8f0', paddingTop: 2, marginTop: 1 }]}>
                                <Text style={s.docInfoLabel}>{t('เงื่อนไข:')}</Text>
                                <Text style={[s.docInfoValue, { color: paymentTerms.paymentType === 'CASH' ? '#16a34a' : '#7c3aed' }]}>
                                    {t(paymentTerms.paymentType === 'CASH' ? 'เงินสด' : `เครดิต ${paymentTerms.creditDays} วัน`)}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Subcon Info */}
                    <View style={s.subconRow}>
                        <View style={s.subconBox}>
                            <Text style={s.subconLabel}>{t('SUBCONTRACTOR')}</Text>
                            <Text style={s.subconValue}>{t(mainJob?.subcontractor || '-')}</Text>
                        </View>
                        <View style={s.subconBox}>
                            <Text style={s.subconLabel}>{t('COMPANY INFO')}</Text>
                            <Text style={[s.subconValue, { fontSize: 8 }]}>{t('บริษัท นีโอสยาม โลจิสติกส์ แอนด์ ทรานสปอร์ต จำกัด')}</Text>
                            <Text style={s.subconSmall}>{t('159/9-10 หมู่ 7 ต.บางม่วง อ.เมืองนครสวรรค์ จ.นครสวรรค์ 60000')}</Text>
                        </View>
                    </View>

                    {/* Table Header */}
                    <View style={s.tableHeader}>
                        <View style={{ width: 28 }}><Text style={s.tableHeaderText}>{t('#')}</Text></View>
                        <View style={{ flex: 1 }}><Text style={[s.tableHeaderText, { textAlign: 'left', paddingLeft: 4 }]}>{t('รายละเอียดบริการ (Description)')}</Text></View>
                        <View style={{ width: 42 }}><Text style={s.tableHeaderText}>{t('จำนวน')}</Text></View>
                        <View style={{ width: 70 }}><Text style={s.tableHeaderText}>{t('ราคาต่อหน่วย')}</Text></View>
                        <View style={{ width: 70 }}><Text style={s.tableHeaderText}>{t('รวมเงิน')}</Text></View>
                    </View>

                    {/* Table Body */}
                    <View style={{ flex: 1 }}>
                        {chunk.map((j, idx) => {
                            const rowIndex = pageIndex * ITEMS_PER_PAGE + idx;
                            const isAlt = idx % 2 === 1;
                            return (
                                <React.Fragment key={j.id}>
                                    <View style={isAlt ? s.tableRowAlt : s.tableRow}>
                                        <View style={s.cellNo}><Text>{t(rowIndex + 1)}</Text></View>
                                        <View style={s.cellDesc}>
                                            <Text style={s.descMain}>{t(`ค่าระวางขนส่ง: ${j.origin} - ${j.destination}`)}</Text>
                                            {j.drops && j.drops.length > 0 && (
                                                <Text style={s.descDrops}>
                                                    {t(`จุดส่งสินค้า (${j.drops.length} จุด): ${j.drops.map((d, i) => `${i + 1}.${d.location}`).join(' ')}`)}
                                                </Text>
                                            )}
                                            <Text style={s.descSub}>
                                                {t(`Service: ${formatDate(j.dateOfService)} | Truck: ${j.licensePlate} (${j.truckType})`)}
                                            </Text>
                                        </View>
                                        <View style={s.cellQty}><Text>{t('1 Trip')}</Text></View>
                                        <View style={s.cellPrice}><Text>{t(formatThaiCurrency(Number(j.cost)))}</Text></View>
                                        <View style={s.cellTotal}><Text>{t(formatThaiCurrency(Number(j.cost)))}</Text></View>
                                    </View>
                                    {Number(j.extraCharge) > 0 && (
                                        <View style={s.tableRowExtra}>
                                            <View style={s.cellNo}><Text></Text></View>
                                            <View style={s.cellDesc}>
                                                <Text style={s.extraText}>{t('- Extra Charge / ค่าใช้จ่ายเพิ่มเติม')}</Text>
                                            </View>
                                            <View style={s.cellQty}><Text style={{ fontSize: 8 }}>{t('1 Job')}</Text></View>
                                            <View style={s.cellPrice}><Text>{t(formatThaiCurrency(Number(j.extraCharge)))}</Text></View>
                                            <View style={s.cellTotal}><Text>{t(formatThaiCurrency(Number(j.extraCharge)))}</Text></View>
                                        </View>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </View>

                    {/* Summary — last page only */}
                    {pageIndex === totalPages - 1 && (
                        <View style={s.summaryDivider}>
                            <View style={s.summaryRow}>
                                <View style={s.summaryLeft}>
                                    <View style={s.remarksBox}>
                                        <Text style={s.remarksLabel}>{t('Remarks / หมายเหตุ')}</Text>
                                        <Text style={s.remarksText}>{t('1. ได้รับเอกสารพัสดุเป็นที่เรียบร้อยและถูกต้องตามเงื่อนไขการวางบิล')}</Text>
                                        <Text style={s.remarksText}>{t('2. การรับชำระเงินจะดำเนินการตามรอบบัญชีที่บริษัทกำหนดไว้')}</Text>
                                    </View>
                                    <View style={s.bahtTextBox}>
                                        <Text style={s.bahtTextValue}>{t(`(${bahtText(netTotal)})`)}</Text>
                                    </View>
                                </View>
                                <View style={s.summaryRight}>
                                    <View style={s.sumLine}>
                                        <Text style={s.sumLabel}>{t('รวมเงินก่อนภาษี (Subtotal)')}</Text>
                                        <Text style={s.sumValue}>{t(formatThaiCurrency(subtotal))}</Text>
                                    </View>
                                    {applyVat && (
                                        <View style={s.sumLine}>
                                            <Text style={s.sumLabel}>{t(`VAT ${vatRate}%`)}</Text>
                                            <Text style={s.sumValue}>{t(formatThaiCurrency(vatAmount))}</Text>
                                        </View>
                                    )}
                                    {applyWht && (
                                        <View style={s.sumLine}>
                                            <Text style={[s.sumLabel, { color: '#dc2626' }]}>{t(`WHT ${whtRate}%`)}</Text>
                                            <Text style={[s.sumValue, { color: '#dc2626' }]}>{t(`-${formatThaiCurrency(whtAmount)}`)}</Text>
                                        </View>
                                    )}
                                    {!applyVat && !applyWht && (
                                        <View style={s.sumLine}>
                                            <Text style={[s.sumLabel, { fontStyle: 'italic', fontSize: 8 }]}>{t('ไม่มีภาษี (No Tax Applied)')}</Text>
                                        </View>
                                    )}
                                    <View style={s.netBox}>
                                        <View>
                                            <Text style={s.netLabel}>{t('ยอดเงินสุทธิ')}</Text>
                                            <Text style={s.netLabelSub}>{t('(NET TOTAL)')}</Text>
                                        </View>
                                        <Text style={s.netValue}>{t(formatThaiCurrency(netTotal))}</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Signatures — last page only */}
                    {pageIndex === totalPages - 1 && (
                        <View style={s.signatureSection}>
                            <View style={s.signatureRow}>
                                <View style={s.signatureBox}>
                                    <View style={s.signatureLine} />
                                    <Text style={s.signatureTitle}>{t('ผู้รับวางบิล (Receiver Signature)')}</Text>
                                    <Text style={s.signatureDate}>{t('Date: ______/______/______')}</Text>
                                </View>
                                <View style={s.signatureBox}>
                                    <View style={s.signatureLine} />
                                    <Text style={s.signatureTitle}>{t('ผู้วางบิล / ผู้รับเงิน (Authorized By)')}</Text>
                                    <Text style={s.signatureDate}>{t(`Date: ${currentDate}`)}</Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Page number */}
                    <Text style={s.pageNumber}>{t(`หน้า ${pageIndex + 1} จาก ${totalPages}`)}</Text>
                </Page>
            ))}
        </Document>
    );
};

/**
 * Generate Invoice PDF blob for printing or downloading
 */
export const generateInvoicePDFBlob = async (props: InvoicePDFProps): Promise<Blob> => {
    await initPDFResources();
    await ensureLogo();
    return pdf(<InvoicePDFDocument {...props} />).toBlob();
};

/**
 * Generate and download Invoice PDF
 */
export const downloadInvoicePDF = async (props: InvoicePDFProps): Promise<void> => {
    const blob = await generateInvoicePDFBlob(props);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Invoice_${props.documentNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

export default InvoicePDFDocument;
