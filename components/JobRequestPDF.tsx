import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, pdf, Image } from '@react-pdf/renderer';
import { Job } from '../types';
import { formatDate } from '../utils/format';

// Use a promise to ensure singleton initialization and wait for it
let fontLoadingPromise: Promise<void> | null = null;
let logoUrl: string | null = null;
const FONT_FAMILY = 'Sarabun_Thai_Fixed';

// Helper to prevent Thai glyph clipping in @react-pdf
const thaiSafeText = (text: string | number | undefined | null) => {
    if (text === undefined || text === null) return '-';
    // Append spaces to ensure the last glyph (like Sara Aa in Sara Am) isn't clipped
    return `${text}  `;
};

/**
 * STRICT Resource loader for PDF
 */
const initPDFResources = async () => {
    if (fontLoadingPromise) return fontLoadingPromise;

    fontLoadingPromise = (async () => {
        try {
            console.log('PDF: Initializing resources...');

            const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

            // Parallel fetch fonts and logo for speed
            const [regRes, boldRes, logoRes] = await Promise.all([
                fetch(`${baseUrl}/fonts/Sarabun-Regular.ttf?v=${Date.now()}`),
                fetch(`${baseUrl}/fonts/Sarabun-Bold.ttf?v=${Date.now()}`),
                fetch(`${baseUrl}/logo.png`).catch(() => null)
            ]);

            // Register Fonts
            if (regRes && regRes.ok && boldRes && boldRes.ok) {
                const [regBlob, boldBlob] = await Promise.all([regRes.blob(), boldRes.blob()]);
                Font.register({
                    family: FONT_FAMILY,
                    fonts: [
                        { src: URL.createObjectURL(regBlob), fontWeight: 400 },
                        { src: URL.createObjectURL(boldBlob), fontWeight: 700 }
                    ]
                });
                console.log('PDF: Fonts registered successfully.');
            }

            // Handle Logo
            if (logoRes && logoRes.ok) {
                const logoBlob = await logoRes.blob();
                logoUrl = URL.createObjectURL(logoBlob);
                console.log('PDF: Logo loaded successfully.');
            }

            console.log('PDF: Resources initialized.');
        } catch (error) {
            console.error('PDF: Resource Error:', error);

            // Minimal fallback
            Font.register({
                family: FONT_FAMILY,
                fonts: [
                    { src: '/fonts/Sarabun-Regular.ttf', fontWeight: 400 },
                    { src: '/fonts/Sarabun-Bold.ttf', fontWeight: 700 }
                ]
            });
        }
    })();

    return fontLoadingPromise;
};

// Styles for PDF
const pStyles = StyleSheet.create({
    page: {
        paddingTop: '10mm',
        paddingBottom: '10mm',
        paddingLeft: '15mm',
        paddingRight: '15mm',
        fontFamily: FONT_FAMILY,
        fontSize: 10,
        color: '#1e293b',
        backgroundColor: '#ffffff',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingBottom: 10,
        borderBottomWidth: 2,
        borderBottomColor: '#1e293b',
        marginBottom: 10,
    },
    companyName: { fontSize: 13, fontWeight: 700, marginBottom: 2 },
    companyNameEN: { fontSize: 8, fontWeight: 700, marginBottom: 4 },
    companyAddress: { fontSize: 8, color: '#64748b', lineHeight: 1.4 },
    logo: { width: 100, height: 'auto' },
    titleSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    title: { fontSize: 18, fontWeight: 700 },
    subtitle: { fontSize: 9, color: '#94a3b8', fontWeight: 700 },
    docInfoBox: { borderWidth: 1, borderColor: '#cbd5e1', width: 195 },
    docInfoRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    docInfoRowLast: { flexDirection: 'row' },
    docInfoLabel: { backgroundColor: '#f8fafc', padding: 4, width: 75, fontSize: 8, fontWeight: 700, borderRightWidth: 1, borderRightColor: '#e2e8f0' },
    docInfoValue: { padding: 4, flex: 1, fontSize: 9, fontWeight: 700 },
    sectionBox: { borderWidth: 1, borderColor: '#cbd5e1', marginBottom: 8 },
    sectionHeader: { backgroundColor: '#f8fafc', padding: 6, borderBottomWidth: 1, borderBottomColor: '#cbd5e1' },
    sectionTitle: { fontSize: 9, fontWeight: 700 },
    sectionContent: { padding: 8 },
    gridRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    gridCol: { flex: 1 },
    infoRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingVertical: 4 },
    infoRowLast: { flexDirection: 'row', paddingVertical: 4 },
    infoLabel: { fontSize: 9, color: '#64748b', width: 85 },
    infoValue: { fontSize: 8.5, fontWeight: 700, textAlign: 'left', paddingLeft: 5, width: 150 }, // Fixed width to prevent clipping
    routingContainer: { paddingVertical: 5 },
    routeDetails: { gap: 6 },
    routeItem: { flexDirection: 'row', paddingVertical: 2 },
    routeLabel: { fontSize: 9, color: '#64748b', width: 135 },
    routeData: { fontSize: 8.5, fontWeight: 700, paddingLeft: 10, width: 250 }, // No flex, high fixed width
    fleetGrid: { flexDirection: 'row', borderWidth: 1, borderColor: '#f1f5f9' },
    fleetCol: { flex: 1, alignItems: 'center', padding: 8, borderRightWidth: 1, borderRightColor: '#f1f5f9' },
    fleetColLast: { flex: 1, alignItems: 'center', padding: 8 },
    fleetLabel: { fontSize: 7, color: '#64748b', fontWeight: 700, marginBottom: 4 },
    fleetValue: { fontSize: 9, fontWeight: 700, textAlign: 'center' },
    remarksBox: { borderWidth: 1, borderColor: '#cbd5e1', padding: 8, minHeight: 50 },
    remarksText: { fontSize: 9, color: '#475569', lineHeight: 1.4 },
    signatureSection: { marginTop: 'auto', paddingTop: 10 },
    signatureRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    signatureBox: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', padding: 8, height: 95, alignItems: 'center', justifyContent: 'space-between' },
    signatureBoxHighlight: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', padding: 8, height: 95, alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc' },
    signatureHeader: { alignItems: 'center' },
    signatureTitle: { fontSize: 9, fontWeight: 700, textAlign: 'center' },
    signatureSubtitle: { fontSize: 7, color: '#64748b', textAlign: 'center' },
    signatureLine: { width: '85%', borderBottomWidth: 1, borderBottomColor: '#94a3b8', borderBottomStyle: 'dotted', marginVertical: 4 },
    signatureName: { fontSize: 9, fontWeight: 700, textAlign: 'center' },
    signatureDate: { fontSize: 8, textAlign: 'center' },
    footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 5, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    footerText: { fontSize: 7, color: '#94a3b8', fontWeight: 700 }
});

interface JobRequestPDFProps {
    job: Job;
}

// PDF Document Component
const JobRequestPDFDocument: React.FC<JobRequestPDFProps> = ({ job }) => {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const documentNumber = `JR-${yearMonth}-${job.id.split('-').pop() || job.id}`;

    return (
        <Document>
            <Page size="A4" style={pStyles.page}>
                {/* Header */}
                <View style={pStyles.header}>
                    <View>
                        <Text style={pStyles.companyName}>บริษัท นีโอสยาม โลจิสติกส์ แอนด์ ทรานสปอร์ต จำกัด</Text>
                        <Text style={pStyles.companyNameEN}>NEOSIAM LOGISTICS & TRANSPORT CO., LTD.</Text>
                        <View style={pStyles.companyAddress}>
                            <Text>159/9-10 หมู่ 7 ต.บางม่วง อ.เมืองนครสวรรค์ จ.นครสวรรค์ 60000</Text>
                            <Text>Tax ID: 0105552087673 | Tel: 056-275-841</Text>
                        </View>
                    </View>
                    <View style={{ width: 100 }}>
                        {logoUrl && <Image src={logoUrl} style={pStyles.logo} />}
                    </View>
                </View>

                {/* Title & Doc Info */}
                <View style={pStyles.titleSection}>
                    <View>
                        <Text style={pStyles.title}>ใบขอใช้รถ</Text>
                        <Text style={pStyles.subtitle}>JOB REQUEST FORM</Text>
                    </View>
                    <View style={pStyles.docInfoBox}>
                        <View style={pStyles.docInfoRow}>
                            <Text style={pStyles.docInfoLabel}>เลขที่ No:</Text>
                            <Text style={pStyles.docInfoValue}>{documentNumber}</Text>
                        </View>
                        <View style={pStyles.docInfoRow}>
                            <Text style={pStyles.docInfoLabel}>วันที่ Date:</Text>
                            <Text style={pStyles.docInfoValue}>{formatDate(new Date())}</Text>
                        </View>
                        <View style={pStyles.docInfoRowLast}>
                            <Text style={pStyles.docInfoLabel}>อ้างอิง Ref:</Text>
                            <Text style={pStyles.docInfoValue}>{job.referenceNo || '-'}</Text>
                        </View>
                    </View>
                </View>

                {/* Section 1 & 2 */}
                <View style={pStyles.gridRow}>
                    <View style={[pStyles.sectionBox, pStyles.gridCol]}>
                        <View style={pStyles.sectionHeader}>
                            <Text style={pStyles.sectionTitle}>1. ข้อมูลงาน (SERVICE SPEC)</Text>
                        </View>
                        <View style={pStyles.sectionContent}>
                            <View style={pStyles.infoRow}>
                                <Text style={pStyles.infoLabel}>วันที่ให้บริการ:</Text>
                                <Text style={pStyles.infoValue}>{formatDate(job.dateOfService)}</Text>
                            </View>
                            <View style={pStyles.infoRow}>
                                <Text style={pStyles.infoLabel}>ประเภทรถ:</Text>
                                <Text style={pStyles.infoValue}>{job.truckType}</Text>
                            </View>
                            <View style={pStyles.infoRowLast}>
                                <Text style={pStyles.infoLabel}>ผู้ขอใช้รถ:</Text>
                                <Text style={pStyles.infoValue}>{job.requestedByName || '-'}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={[pStyles.sectionBox, pStyles.gridCol]}>
                        <View style={pStyles.sectionHeader}>
                            <Text style={pStyles.sectionTitle}>2. รายละเอียดสินค้า (SHIPMENT)</Text>
                        </View>
                        <View style={pStyles.sectionContent}>
                            <View style={pStyles.infoRow}>
                                <Text style={pStyles.infoLabel}>สินค้า:</Text>
                                <Text style={pStyles.infoValue}>{job.productDetail || 'ไม่ระบุ'}</Text>
                            </View>
                            <View style={pStyles.infoRow}>
                                <Text style={pStyles.infoLabel}>น้ำหนัก/ปริมาตร:</Text>
                                <Text style={pStyles.infoValue}>{job.weightVolume ? `${job.weightVolume} กก.` : '-'}</Text>
                            </View>
                            <View style={pStyles.infoRowLast}>
                                <Text style={pStyles.infoLabel}>จำนวน/Type:</Text>
                                <Text style={pStyles.infoValue}>1 เที่ยว (Single Trip)</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Section 3: Routing - Redesigned to be clipping-proof */}
                <View style={pStyles.sectionBox}>
                    <View style={pStyles.sectionHeader}>
                        <Text style={pStyles.sectionTitle}>3. เส้นทางการขนส่ง (ROUTING)</Text>
                    </View>
                    <View style={pStyles.sectionContent}>
                        <View style={pStyles.routingContainer}>
                            <View style={pStyles.routeDetails}>
                                <View style={pStyles.routeItem}>
                                    <Text style={pStyles.routeLabel}>ต้นทาง (ORIGIN):</Text>
                                    <Text style={pStyles.routeData}>{thaiSafeText(job.origin)}</Text>
                                </View>
                                <View style={pStyles.routeItem}>
                                    <Text style={pStyles.routeLabel}>ปลายทาง (DESTINATION):</Text>
                                    <Text style={pStyles.routeData}>{thaiSafeText(job.destination)}</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Section 4: Fleet */}
                <View style={pStyles.sectionBox}>
                    <View style={pStyles.sectionHeader}>
                        <Text style={pStyles.sectionTitle}>4. ข้อมูลคนขับและบริษัทรถร่วม (FLEET & DRIVER)</Text>
                    </View>
                    <View style={pStyles.fleetGrid}>
                        <View style={pStyles.fleetCol}>
                            <Text style={pStyles.fleetLabel}>SUBCONTRACTOR</Text>
                            <Text style={pStyles.fleetValue}>{job.subcontractor || 'รอการจัดรถ'}</Text>
                        </View>
                        <View style={pStyles.fleetCol}>
                            <Text style={pStyles.fleetLabel}>LICENSE PLATE</Text>
                            <Text style={pStyles.fleetValue}>{job.licensePlate || 'รอระบุเลขทะเบียน'}</Text>
                        </View>
                        <View style={pStyles.fleetColLast}>
                            <Text style={pStyles.fleetLabel}>DRIVER NAME & TEL</Text>
                            <Text style={pStyles.fleetValue}>{job.driverName || 'รอระบุรายชื่อ'}</Text>
                            {job.driverPhone && <Text style={[pStyles.fleetValue, { fontSize: 8 }]}>{job.driverPhone}</Text>}
                        </View>
                    </View>
                </View>

                {/* Section 5: Remarks */}
                <View style={pStyles.sectionBox}>
                    <View style={pStyles.sectionHeader}>
                        <Text style={pStyles.sectionTitle}>5. หมายเหตุและข้อกำหนดเพิ่มเติม (REMARKS)</Text>
                    </View>
                    <View style={pStyles.sectionContent}>
                        <Text style={pStyles.remarksText}>{job.remark || '- ไม่มีข้อมูลเพิ่มเติม -'}</Text>
                    </View>
                </View>

                {/* Signatures - Fixed Centering */}
                <View style={pStyles.signatureSection}>
                    <View style={pStyles.signatureRow}>
                        <View style={pStyles.signatureBox}>
                            <View style={pStyles.signatureHeader}>
                                <Text style={pStyles.signatureTitle}>ต้นทาง / ผู้จ่ายสินค้า</Text>
                                <Text style={pStyles.signatureSubtitle}>(DISPATCHER)</Text>
                            </View>
                            <View style={pStyles.signatureLine} />
                            <Text style={pStyles.signatureDate}>วันที่ ____/____/____</Text>
                        </View>
                        <View style={pStyles.signatureBox}>
                            <View style={pStyles.signatureHeader}>
                                <Text style={pStyles.signatureTitle}>พนักงานขับรถ</Text>
                                <Text style={pStyles.signatureSubtitle}>(DRIVER)</Text>
                            </View>
                            <View style={pStyles.signatureLine} />
                            <Text style={pStyles.signatureDate}>วันที่ ____/____/____</Text>
                        </View>
                        <View style={pStyles.signatureBox}>
                            <View style={pStyles.signatureHeader}>
                                <Text style={pStyles.signatureTitle}>ปลายทาง / ผู้รับสินค้า</Text>
                                <Text style={pStyles.signatureSubtitle}>(RECEIVER)</Text>
                            </View>
                            <View style={pStyles.signatureLine} />
                            <Text style={pStyles.signatureDate}>วันที่ ____/____/____</Text>
                        </View>
                    </View>
                    <View style={pStyles.signatureRow}>
                        <View style={pStyles.signatureBoxHighlight}>
                            <View style={pStyles.signatureHeader}>
                                <Text style={pStyles.signatureTitle}>ผู้ขอใช้รถ</Text>
                                <Text style={pStyles.signatureSubtitle}>(REQUESTER)</Text>
                            </View>
                            {/* Grouping Name and Date at the bottom to leave space for signature in the middle */}
                            <View style={{ alignItems: 'center', gap: 2 }}>
                                <Text style={pStyles.signatureName}>{thaiSafeText(job.requestedByName)}</Text>
                                <Text style={pStyles.signatureDate}>วันที่ ____/____/____</Text>
                            </View>
                        </View>
                        <View style={pStyles.signatureBox}>
                            <View style={pStyles.signatureHeader}>
                                <Text style={pStyles.signatureTitle}>ผู้อนุมัติ</Text>
                                <Text style={pStyles.signatureSubtitle}>(AUTHORIZED)</Text>
                            </View>
                            <View style={pStyles.signatureLine} />
                            <Text style={pStyles.signatureDate}>วันที่ ____/____/____</Text>
                        </View>
                        <View style={pStyles.signatureBox}>
                            <View style={pStyles.signatureHeader}>
                                <Text style={pStyles.signatureTitle}>บัญชี / การเงิน</Text>
                                <Text style={pStyles.signatureSubtitle}>(ACCOUNTANT)</Text>
                            </View>
                            <View style={pStyles.signatureLine} />
                            <Text style={pStyles.signatureDate}>วันที่ ____/____/____</Text>
                        </View>
                    </View>
                </View>

                {/* Footer */}
                <View style={pStyles.footer}>
                    <Text style={pStyles.footerText}>FM-OP01-08 REV.00</Text>
                </View>
            </Page>
        </Document>
    );
};

// Function to generate and download PDF
export const generateJobRequestPDF = async (job: Job): Promise<void> => {
    // Ensure resources are ready
    await initPDFResources();

    const blob = await pdf(<JobRequestPDFDocument job={job} />).toBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const documentNumber = `JR-${yearMonth}-${job.id.split('-').pop() || job.id}`;

    link.download = `Job_Request_${documentNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

export default JobRequestPDFDocument;
