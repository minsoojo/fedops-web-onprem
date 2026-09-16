//useTaskData.js
import { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import { socketUrl } from '../../lib/runtimeConfig';
import { isEqual } from 'lodash';

export const useTaskData = (_id) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({}); // Add this state variable to store the status updates
  const socketRef = useRef(null);
  const prevDataRef = useRef(null);

  const requestData = () => {
    socketRef.current.emit('requestData', _id);
  };

  useEffect(() => {
    socketRef.current = io(socketUrl, { withCredentials: true }); //same as socket server address

    const handleUpdateTask = (updatedData) => {
      console.log('updatedData', updatedData);
      if (!isEqual(prevDataRef.current, updatedData)) {
        setData(updatedData);
        setLoading(false);
      } else {
        setLoading(false);
      }
      prevDataRef.current = updatedData;
    };

    // Add this function to handle status updates
    const handleUpdateStatus = (updatedStatus) => {
      console.log('updatedStatus', updatedStatus);
      setStatus(updatedStatus.status); // Save the received status updates in the state
    };

    socketRef.current.on('updateTask', handleUpdateTask);
    socketRef.current.on('updateFlServerStatus', handleUpdateStatus); // Add this event listener

    setLoading(true);
    requestData();

    const interval = setInterval(requestData, 5 * 1000);

    return () => {
      if (socketRef.current) {
        socketRef.current.off('updateTask', handleUpdateTask);
        socketRef.current.off('updateFlServerStatus', handleUpdateStatus); // Remove this event listener
        socketRef.current.disconnect();
      }
      clearInterval(interval);
    };
  }, [_id]);

  return { data, loading, requestData, socketRef, status }; // Add status here
};
