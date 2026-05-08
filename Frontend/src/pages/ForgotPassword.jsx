import React, { useState } from 'react';
import { apiRequest } from '../utils/apiClient';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    await apiRequest({ method: 'post', path: '/api/auth/forgot-password', data: { email } });
    setMsg('अगर ईमेल मौजूद है तो रीसेट लिंक भेज दिया गया है।');
  };

  return <div className="min-h-screen flex items-center justify-center"><form onSubmit={submit} className="bg-white p-6 rounded shadow w-96"><h2 className="text-xl font-bold mb-3">Forgot Password</h2><input className="w-full border p-2 mb-3" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required /><button className="w-full bg-blue-600 text-white p-2 rounded">Send Reset Link</button><p className="mt-3 text-green-600">{msg}</p></form></div>;
}
