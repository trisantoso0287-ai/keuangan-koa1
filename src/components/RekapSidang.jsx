import { useState, useEffect, Fragment } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

function RekapSidang() {
  const [semuaTransaksi, setSemuaTransaksi] = useState([]);
  const [loading, setLoading] = useState(true);

  // State Filter Tahun
  const tahunSekarang = new Date().getFullYear().toString();
  const [filterTahun, setFilterTahun] = useState(tahunSekarang);

  // State Target (Menyimpan input manual ke Local Storage agar tidak hilang saat refresh)
  const [targets, setTargets] = useState(() => {
    const saved = localStorage.getItem('rekapTargets');
    return saved ? JSON.parse(saved) : {};
  });

  // Simpan ke Local Storage setiap kali ada perubahan pada state 'targets'
  useEffect(() => {
    localStorage.setItem('rekapTargets', JSON.stringify(targets));
  }, [targets]);

  useEffect(() => {
    const q = query(collection(db, 'transaksi'), orderBy('tanggal', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let daftarTransaksi = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const jumlah = Number(data.jumlah || data.nominal || data.total) || 0;
        
        const jenis = String(data.jenis || data.tipe || data.kategori_transaksi || '').toLowerCase();
        const apakahMasuk = jenis.includes('terima') || jenis.includes('pendapatan') || jenis.includes('masuk');
        
        const rawKategori = String(data.kategori || data.keterangan || '');
        let noMA = '-';
        let namaMA = rawKategori;

        if (rawKategori.includes('-')) {
          const parts = rawKategori.split('-');
          noMA = parts[0].trim();
          namaMA = parts.slice(1).join('-').trim();
        }

        const jemaatName = data.jemaat || data.namaJemaat || data.penyetor || 'Tanpa Keterangan Jemaat';

        daftarTransaksi.push({
          id: doc.id,
          ...data,
          jumlahAktual: jumlah,
          noMA: noMA,
          namaMA: namaMA || '-',
          apakahMasuk: apakahMasuk,
          jemaatName: jemaatName
        });
      });

      setSemuaTransaksi(daftarTransaksi);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const formatRupiah = (angka) => {
    if (angka === 0 || !angka) return '-';
    return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(angka);
  };

  const formatAngkaExcel = (angka) => {
    if (angka === 0 || !angka) return '-';
    return angka;
  };

  const hitungPersentase = (jumlah, target) => {
    if (!target || target <= 0) return '-';
    const persen = (jumlah / target) * 100;
    return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(persen) + '%';
  };

  // Update nilai target pada state
  const handleTargetChange = (key, value) => {
    setTargets(prev => ({
      ...prev,
      [key]: Number(value)
    }));
  };

  // ========================================================
  // PEMROSESAN DATA
  // ========================================================
  const transaksiTahunIni = semuaTransaksi.filter(t => t.tanggal && t.tanggal.startsWith(filterTahun));
  const rekapSidang = {};

  transaksiTahunIni.forEach(t => {
    const key = `${t.noMA}_${t.namaMA}`;
    const groupCode = t.noMA.charAt(0).toUpperCase(); 

    if (!rekapSidang[key]) {
      rekapSidang[key] = {
        groupCode: groupCode || 'Lainnya',
        noMA: t.noMA,
        namaMA: t.namaMA,
        apakahMasuk: t.apakahMasuk,
        totalSetahun: 0,
        jemaatRincian: {}
      };
    }

    rekapSidang[key].totalSetahun += t.jumlahAktual;

    if (t.apakahMasuk) {
      if (!rekapSidang[key].jemaatRincian[t.jemaatName]) {
        rekapSidang[key].jemaatRincian[t.jemaatName] = 0;
      }
      rekapSidang[key].jemaatRincian[t.jemaatName] += t.jumlahAktual;
    }
  });

  const rawArray = Object.values(rekapSidang);
  const groupedData = {};

  rawArray.forEach(item => {
    if (!groupedData[item.groupCode]) {
      groupedData[item.groupCode] = { items: [], subtotalJumlah: 0, subtotalTarget: 0 };
    }
    groupedData[item.groupCode].items.push(item);
    groupedData[item.groupCode].subtotalJumlah += item.totalSetahun;
    
    // Ambil nilai target untuk item ini dari state
    const targetKey = `${filterTahun}_${item.noMA}`;
    groupedData[item.groupCode].subtotalTarget += (targets[targetKey] || 0);
  });

  const sortedGroupKeys = Object.keys(groupedData).sort();
  sortedGroupKeys.forEach(key => {
    groupedData[key].items.sort((a, b) => a.noMA.localeCompare(b.noMA));
  });

  // ========================================================
  // FUNGSI EXPORT KE EXCEL
  // ========================================================
  const handleDownloadExcel = () => {
    const tableHtml = document.getElementById('tabel-export-excel').outerHTML;
    const htmlTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="UTF-8">
          <style>
            table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; width: 100%; }
            th, td { border: 1px solid black; padding: 6px; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .bg-gray { background-color: #f3f4f6; }
            .italic { font-style: italic; }
            .no-border { border: none !important; }
          </style>
        </head>
        <body>
          ${tableHtml}
        </body>
      </html>
    `;

    const blob = new Blob([htmlTemplate], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rekap_Sidang_Koa1_${filterTahun}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="text-center p-8 text-slate-500">Memuat Data Rekap Sidang...</div>;

  return (
    <div className="animate-fade-in w-full">
      
      {/* TAMPILAN APLIKASI / WEB */}
      <div className="space-y-6 print:hidden">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Rekapitulasi Sidang Jemaat</h2>
              <p className="text-sm text-slate-500">Pencapaian Target Anggaran Penerimaan dan Belanja</p>
            </div>
            <button onClick={handleDownloadExcel} className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-5 py-2 rounded-lg text-sm shadow transition-colors whitespace-nowrap flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              Download Excel
            </button>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 inline-block w-full sm:w-auto">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tahun Rekapitulasi</label>
            <input 
              type="number" 
              value={filterTahun} 
              onChange={(e) => setFilterTahun(e.target.value)} 
              className="w-full sm:w-48 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-blue-500" 
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-slate-800 text-white font-bold text-sm">
                  <th className="p-4 w-16 text-center border-r border-slate-700">NO MA</th>
                  <th className="p-4 border-r border-slate-700">MATA ANGGARAN</th>
                  <th className="p-4 text-right bg-slate-700 w-48 border-r border-slate-600">JUMLAH (Rp)</th>
                  <th className="p-4 text-right bg-blue-900 w-48 border-r border-blue-800">TARGET (Rp)</th>
                  <th className="p-4 text-center bg-slate-900 w-24">PERSENTASE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {sortedGroupKeys.length === 0 ? (
                  <tr><td colSpan="5" className="text-center p-8 text-slate-400">Tidak ada realisasi pada tahun terpilih.</td></tr>
                ) : (
                  sortedGroupKeys.map(groupKey => (
                    <Fragment key={groupKey}>
                      {groupedData[groupKey].items.map((row, index) => {
                        const targetKey = `${filterTahun}_${row.noMA}`;
                        const nilaiTarget = targets[targetKey] || '';

                        return (
                          <Fragment key={`${groupKey}-${index}`}>
                            <tr className="hover:bg-slate-50 transition-colors">
                              <td className="p-3 text-center font-bold text-slate-700 border-r border-slate-200">{row.noMA}</td>
                              <td className="p-3 font-bold text-slate-800 border-r border-slate-200">{row.namaMA}</td>
                              <td className="p-3 text-right font-bold text-slate-800 bg-slate-50 border-r border-slate-200">{formatRupiah(row.totalSetahun)}</td>
                              
                              {/* Kolom Input Target Manual */}
                              <td className="p-2 border-r border-slate-200 bg-blue-50/30">
                                <input 
                                  type="number" 
                                  value={nilaiTarget}
                                  onChange={(e) => handleTargetChange(targetKey, e.target.value)}
                                  placeholder="Ketik target..."
                                  className="w-full text-right bg-white border border-slate-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                                />
                              </td>
                              
                              <td className="p-3 text-center font-bold text-slate-700">{hitungPersentase(row.totalSetahun, nilaiTarget)}</td>
                            </tr>
                            
                            {/* Baris Rincian Jemaat (Khusus Penerimaan) */}
                            {row.apakahMasuk && Object.keys(row.jemaatRincian).sort().map((jemKey) => {
                              const jumlahJem = row.jemaatRincian[jemKey];
                              if (jumlahJem > 0) {
                                return (
                                  <tr key={`${row.noMA}-${jemKey}`} className="bg-slate-50/40 text-xs">
                                    <td className="p-2 border-r border-slate-200"></td>
                                    <td className="p-2 pl-6 text-slate-500 border-r border-slate-200">- {jemKey}</td>
                                    <td className="p-2 text-right font-medium text-slate-600 bg-slate-50 border-r border-slate-200">{formatRupiah(jumlahJem)}</td>
                                    <td className="p-2 border-r border-slate-200 bg-blue-50/10"></td>
                                    <td className="p-2 text-center text-slate-400">-</td>
                                  </tr>
                                );
                              }
                              return null;
                            })}
                          </Fragment>
                        );
                      })}

                      {/* Baris Subtotal Grup */}
                      <tr className="bg-slate-200 font-bold text-slate-800 border-y-2 border-slate-300">
                        <td colSpan="2" className="p-3 text-right border-r border-slate-300 uppercase tracking-wide">JUMLAH KODE {groupKey}</td>
                        <td className="p-3 text-right border-r border-slate-300">{formatRupiah(groupedData[groupKey].subtotalJumlah)}</td>
                        <td className="p-3 text-right border-r border-slate-300">{formatRupiah(groupedData[groupKey].subtotalTarget)}</td>
                        <td className="p-3 text-center">{hitungPersentase(groupedData[groupKey].subtotalJumlah, groupedData[groupKey].subtotalTarget)}</td>
                      </tr>
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ==========================================
          TABEL HIDDEN UNTUK EXPORT EXCEL
          ========================================== */}
      <table id="tabel-export-excel" style={{ display: 'none' }}>
        <thead>
          <tr>
            <th colSpan="5" className="text-center font-bold no-border" style={{ fontSize: '14px' }}>
              REALISASI ANGGARAN PENERIMAAN DAN BELANJA
            </th>
          </tr>
          <tr>
            <th colSpan="5" className="text-center font-bold no-border" style={{ fontSize: '14px' }}>
              JEMAAT KOA 1
            </th>
          </tr>
          <tr>
            <th colSpan="5" className="text-center font-bold no-border" style={{ fontSize: '14px', paddingBottom: '15px' }}>
              TAHUN {filterTahun}
            </th>
          </tr>
          <tr>
            <th className="font-bold text-center" style={{ width: '60px' }}>NO<br/>MA</th>
            <th className="font-bold text-center" style={{ width: '250px' }}>MATA ANGGARAN</th>
            <th className="font-bold text-center" style={{ width: '120px' }}>JUMLAH</th>
            <th className="font-bold text-center" style={{ width: '120px' }}>TARGET</th>
            <th className="font-bold text-center" style={{ width: '80px' }}>%</th>
          </tr>
        </thead>
        <tbody>
          {sortedGroupKeys.length === 0 ? (
            <tr><td colSpan="5" className="text-center italic">Tidak ada data untuk tahun {filterTahun}</td></tr>
          ) : (
            sortedGroupKeys.map(groupKey => (
              <Fragment key={`xl-${groupKey}`}>
                {groupedData[groupKey].items.map((row, index) => {
                  const targetKey = `${filterTahun}_${row.noMA}`;
                  const nilaiTarget = targets[targetKey] || 0;

                  return (
                    <Fragment key={`xl-${groupKey}-${index}`}>
                      {/* Baris Induk */}
                      <tr className="font-bold">
                        <td className="text-center">{row.noMA}</td>
                        <td>{row.namaMA}</td>
                        <td className="text-right">{formatAngkaExcel(row.totalSetahun)}</td>
                        <td className="text-right">{formatAngkaExcel(nilaiTarget)}</td>
                        <td className="text-center">{hitungPersentase(row.totalSetahun, nilaiTarget)}</td>
                      </tr>

                      {/* Baris Rincian Jemaat */}
                      {row.apakahMasuk && Object.keys(row.jemaatRincian).sort().map(jemKey => {
                        const jumlahJem = row.jemaatRincian[jemKey];
                        if (jumlahJem > 0) {
                          return (
                            <tr key={`xl-${row.noMA}-${jemKey}`} className="italic">
                              <td></td>
                              <td>- {jemKey}</td>
                              <td className="text-right">{formatAngkaExcel(jumlahJem)}</td>
                              <td></td>
                              <td></td>
                            </tr>
                          );
                        }
                        return null;
                      })}
                    </Fragment>
                  );
                })}

                {/* Subtotal Grup */}
                <tr className="font-bold bg-gray">
                  <td colSpan="2" className="text-right">JUMLAH KODE {groupKey}</td>
                  <td className="text-right">{formatAngkaExcel(groupedData[groupKey].subtotalJumlah)}</td>
                  <td className="text-right">{formatAngkaExcel(groupedData[groupKey].subtotalTarget)}</td>
                  <td className="text-center">{hitungPersentase(groupedData[groupKey].subtotalJumlah, groupedData[groupKey].subtotalTarget)}</td>
                </tr>
              </Fragment>
            ))
          )}
          
          {/* Baris Kosong untuk Jarak */}
          <tr><td colSpan="5" className="no-border" style={{ height: '30px' }}></td></tr>
          
          {/* Bagian Tanda Tangan */}
          <tr>
            <td colSpan="2" className="text-center no-border">Mengetahui,<br/>Ketua Majelis Jemaat</td>
            <td colSpan="1" className="no-border"></td>
            <td colSpan="2" className="text-center no-border">Bendahara</td>
          </tr>
          <tr><td colSpan="5" className="no-border" style={{ height: '60px' }}></td></tr>
          <tr>
            <td colSpan="2" className="text-center no-border font-bold">(..................................................)</td>
            <td colSpan="1" className="no-border"></td>
            <td colSpan="2" className="text-center no-border font-bold">(..................................................)</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default RekapSidang;