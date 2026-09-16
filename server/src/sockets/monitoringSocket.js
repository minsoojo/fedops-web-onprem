// server/src/sockets/monitoringSockets.js
import mongoose from 'mongoose';
import Grid from 'gridfs-stream';
import {
  canManageSocketTask,
  rejectSocketTaskAccess,
} from '../lib/socketAuth.js';

const monitoringSockets = (io) => {
  let gfs;

  const conn = mongoose.connection;
  conn.once('open', () => {
    gfs = Grid(conn.db, mongoose.mongo);
    gfs.collection('fedops'); // Set the collection name to search for files
  });

  io.on('connection', (socket) => {
    console.log('Socket Connected'); 

    socket.on('get_monitoring', async ({ _id, modelVersion, macAddress }) => {
      console.log(
        'get_monitoring Received',
        _id,
        modelVersion,
        macAddress?.macAddress || macAddress,
      );
      if (!await canManageSocketTask(socket, _id)) {
        rejectSocketTaskAccess(socket);
        return;
      }
      try {
        // Define collections
        const collection1 = mongoose.connection.collection(
          'fl-client_train_result_log',
        );
        const collection2 = mongoose.connection.collection(
          'fl-client_test_result_log',
        );
        const collection3 = mongoose.connection.collection(
          'fl-client_basic_system_log',
        );
        const collection4 = mongoose.connection.collection(
          'fl-gl_model_evaluation_log',
        );  

        // Execute query and retrieve data from multiple collections
        const data1 = await collection1
          .find({ fl_task_id: _id, gl_model_v: modelVersion, client_mac: macAddress })
          .toArray();
        const data2 = await collection2
          .find({
            fl_task_id: _id,
            gl_model_v: modelVersion,
            client_mac: macAddress,
          })
          .toArray();
        const data3 = await collection3
          .find({
            fl_task_id: _id,
            gl_model_v: modelVersion,
            client_mac: macAddress,
          })
          .toArray();
          const data4 = await collection4
            .find({
              fl_task_id: _id,
              gl_model_v: modelVersion,
            })
            .toArray();

        console.log('Data1:', data1);
        console.log('Data2:', data2);
        console.log('Data3:', data3);
        console.log('Data4:', data4);

        // Combine data into one object
        const data = {
          trainResultLog: data1,
          testResultLog: data2,
          basicSystemLog: data3,
          globalModelLog: data4,
        };

        // Send data back to client
        socket.emit('response_monitoring', data);
      } catch (error) {
        console.error('Error retrieving data from MongoDB:', error);
      }
    });

    socket.on('getModelVersion', async (title) => {
    console.log('getModelVersion Received', title);
    if (!await canManageSocketTask(socket, title)) {
      rejectSocketTaskAccess(socket);
      return;
    }
    try {
        const collection = mongoose.connection.collection(
        'fl-client_train_result_log',
        );

        // Get the document with the highest next_gl_model_v for this task id
        const data = await collection
        .find({ fl_task_id: title })
        .sort({ gl_model_v: -1 }) // Sort by next_gl_model_v in descending order
        .limit(1) // Limit to the first document (highest next_gl_model_v)
        .toArray();

        // Check if any document was found
        if (data.length > 0) {
        const latestModelVersion = data[0].gl_model_v;

        console.log('Latest Model Version:', latestModelVersion);

        // Emit the latest model version back to the client
        socket.emit('returnModelVersion', latestModelVersion);
        } else {
        console.log('No documents found for this task id');
        socket.emit('returnModelVersion', null);
        }
    } catch (error) {
        console.error('Error retrieving data from MongoDB:', error);
    }
    });

      socket.on('getMacAddresses', async ({ title }) => {
        console.log('getMacAddresses Received', title);
        if (!await canManageSocketTask(socket, title)) {
          rejectSocketTaskAccess(socket);
          return;
        }
        try {
          // Define collection
          const collection = mongoose.connection.collection(
            'fl-client_train_result_log',
          );

          // Retrieve distinct MAC addresses
          const macAddresses = await collection.distinct('client_mac', {
            fl_task_id: title,
          });

          const clientName = await collection.distinct('client_name', {
            client_mac: macAddresses,
          });


          console.log('MAC Addresses:', macAddresses);
          console.log('Client Name:', clientName);

          // const deviceInfo({client_mac: macAddresses})
          // Send MAC addresses back to client
          socket.emit('returnMacAddresses', macAddresses);
        } catch (error) {
          console.error('Error retrieving data from MongoDB:', error);
        }
      });

      const findClientName = async ( macAddresses ) => {
          const collection = mongoose.connection.collection(
          'fl-client_train_result_log',
        );

        // Retrieve distinct MAC addresses
        const clientName = await collection.distinct('client_name', {
          client_mac: macAddresses
        });
        console.log("여기에요 여기", clientName[0]);
        return clientName[0];
      };

      socket.on('get_MAC_Addresses_by_modelVersion', async ({title, modelVersion}) => {
        console.log('getMacAddresses Received title', title);
        console.log('getMacAddresses Received modelVersion', modelVersion);
        if (!await canManageSocketTask(socket, title)) {
          rejectSocketTaskAccess(socket);
          return;
        }

        try {
            // Define collection
            const collection = mongoose.connection.collection(
              'fl-client_train_result_log',
            );
  
            // Retrieve distinct MAC addresses
            const macAddresses = await collection.distinct('client_mac', {
              fl_task_id: title, gl_model_v: modelVersion
            });
            
            console.log('MAC Addresses:', macAddresses);
            // Send MAC addresses back to client
            socket.emit('returnMacAddresses', macAddresses);
          } catch (error) {
            console.error('Error retrieving data from MongoDB:', error);
          }
        });
            // 이미지 요청 이벤트
      socket.on('getImage', async ({ taskId, modelName, glModel }) => {
        console.log('getImage Received', taskId, modelName, glModel);
        if (!await canManageSocketTask(socket, taskId)) {
          rejectSocketTaskAccess(socket);
          return;
        }
        
        const fileName = `${taskId}_${modelName}_local_model_V${glModel}.png`;
        
        try {
          // GridFS에서 파일 찾기
          const file = await gfs.files.findOne({ filename: fileName });
  
          if (!file) {
            console.error('File not found:', fileName);
            socket.emit('returnImage', { error: 'File not found' });
            return;
          }
  
          // 파일 스트림 생성
          const readStream = gfs.createReadStream({ filename: fileName });
          const chunks = [];
  
          readStream.on('data', (chunk) => {
            chunks.push(chunk);
          });
  
          readStream.on('end', () => {
            const buffer = Buffer.concat(chunks);
            const base64Image = buffer.toString('base64');
            const imageUrl = `data:image/png;base64,${base64Image}`;
  
            // 클라이언트로 이미지 전송
            socket.emit('returnImage', { imageUrl });
          });
  
          readStream.on('error', (err) => {
            console.error('Error reading file:', err);
            socket.emit('returnImage', { error: 'Error reading file' });
          });
        } catch (error) {
          console.error('Error retrieving image from GridFS:', error);
          socket.emit('returnImage', { error: 'Failed to retrieve image' });
        }
      });
  });
};


export default monitoringSockets;
