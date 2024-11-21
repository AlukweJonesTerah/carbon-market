import React, { useEffect, useState } from 'react';
import axios from 'axios';

const UserInfo = () => {
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await axios.get('/me');
        setUserInfo(response.data);
      } catch (error) {
        setError(error.response?.data?.detail || 'Error fetching user info');
      } finally {
        setLoading(false);
      }
    };

    fetchUserInfo();
  }, []);

  if (loading) return <p>Loading user info...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="user-info">
      <h2>User Information</h2>
      <p><strong>Username:</strong> {userInfo.username}</p>
      <p><strong>Email:</strong> {userInfo.email}</p>
      <p><strong>Celo Address:</strong> {userInfo.celoAddress}</p>
    </div>
  );
};

export default UserInfo;
