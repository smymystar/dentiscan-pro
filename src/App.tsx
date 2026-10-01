import React, { useState } from 'react';

export default function App() {
  const [formData, setFormData] = useState({
    hn: '',
    name: '',
    age: '',
    screeningResult: 'ปกติ',
    DentView: ''
  });

  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // ลิงก์ Google Apps Script Web App ของคุณ
  const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxllWTwnMq6FhUGhSALtgsnSFU_gLRApdgwJZlV2i9dRCAqeTLx5JMXQttAtlkI-BsU/exec";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMessage('');

    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      alert('บันทึกข้อมูลสำเร็จ!');
      setStatusMessage('✅ บันทึกข้อมูลเข้า Google Sheet เรียบร้อยแล้ว');
      
      setFormData({
        hn: '',
        name: '',
        age: '',
        screeningResult: 'ปกติ',
        DentView: ''
      });
    } catch (error) {
      console.error('Error saving data:', error);
      alert('บันทึกไม่สำเร็จ: เกิดข้อผิดพลาดในการเชื่อมต่อ');
      setStatusMessage('❌ บันทึกไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-6 rounded-2xl shadow-lg">
        <h2 className="text-2xl font-bold text-purple-700 text-center mb-2">🦷 DentiScan Pro</h2>
        <p className="text-sm text-gray-500 text-center mb-6">ระบบคัดกรองสุขภาพช่องปาก (Google Sheets)</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">เลข HN *</label>
            <input
              type="text"
              name="hn"
              value={formData.hn}
              onChange={handleChange}
              required
              className="mt-1 w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              placeholder="ระบุเลข HN"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">ชื่อ - สกุล *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="mt-1 w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              placeholder="ชื่อผู้รับบริการ"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">อายุ (ปี) *</label>
            <input
              type="number"
              name="age"
              value={formData.age}
              onChange={handleChange}
              required
              className="mt-1 w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              placeholder="อายุ"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">ผลการคัดกรอง</label>
            <select
              name="screeningResult"
              value={formData.screeningResult}
              onChange={handleChange}
              className="mt-1 w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="ปกติ">ปกติ (ไม่ต้องใส่)</option>
              <option value="ฟันผุต้องอุด">ฟันผุต้องอุด</option>
              <option value="มีหินปูน/เหงือกอักเสบ">มีหินปูน/เหงือกอักเสบ</option>
              <option value="เสี่ยงโรคในช่องปาก">เสี่ยงโรคในช่องปาก</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">คำแนะนำเพิ่มเติม (DentView)</label>
            <textarea
              name="DentView"
              value={formData.DentView}
              onChange={handleChange}
              rows={2}
              className="mt-1 w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              placeholder="ระบุคำแนะนำ..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 text-white p-3 rounded-lg font-bold hover:bg-purple-700 transition disabled:bg-gray-400"
          >
            {loading ? 'กำลังบันทึกข้อมูล...' : 'บันทึกข้อมูลเข้า Google Sheet'}
          </button>
        </form>

        {statusMessage && (
          <p className="text-center text-sm mt-4 font-medium text-gray-700">{statusMessage}</p>
        )}
      </div>
    </div>
  );
}
