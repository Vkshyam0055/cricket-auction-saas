import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../utils/apiClient';

export default function CompleteProfileEmail() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const token = localStorage.getItem('token');
      const phone = localStorage.getItem('organizerPhone');
      await apiRequest({
        method: 'post',
        path: '/api/auth/complete-profile-email',
        data: { phone, email },
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      localStorage.setItem('organizerEmail', String(email).trim().toLowerCase());
      nav('/dashboard');
    } catch (ex) {
      setErr(ex.response?.data?.message || 'Update failed');
    }
  };

  return <div className="min-h-screen flex items-center justify-center"><form onSubmit={submit} className="bg-white p-6 rounded shadow w-96"><h2 className="text-xl font-bold mb-2">Email Required</h2><p className="text-sm mb-3">Dashboard access के लिए ईमेल अपडेट करें।</p><input type="email" required className="w-full border p-2 mb-3" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" /><button className="w-full bg-blue-600 text-white p-2 rounded">Save Email</button><p className="text-red-500 mt-2">{err}</p></form></div>;
}
