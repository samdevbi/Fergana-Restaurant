# Socket.io Frontend Connection Guide

## Connection Information

### Backend Endpoint
- **WebSocket URL**: `ws://localhost:3003` (development)
- **Production**: Use your backend server URL (e.g., `wss://your-backend.com`)
- **Port**: Same as your HTTP API port (default: 3003)

---

## Installation

```bash
npm install socket.io-client
# or
yarn add socket.io-client
```

---

## Connection Setup

### 1. Basic Connection (For Customers - QR Orders)

```javascript
import io from 'socket.io-client';

// Connect to WebSocket server
const socket = io('http://localhost:3003', {
  // No authentication needed for customers
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
});

// Connection events
socket.on('connect', () => {
  console.log('Connected to server:', socket.id);
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
});
```

### 2. Authenticated Connection (For Staff/Owner)

```javascript
import io from 'socket.io-client';

// Get JWT token from your auth system
const token = localStorage.getItem('accessToken'); // or from cookies

const socket = io('http://localhost:3003', {
  auth: {
    token: token, // Send token in auth object
  },
  // OR send via cookie (if using cookies)
  // The backend also checks cookies automatically
  autoConnect: true,
  reconnection: true,
});

socket.on('connect', () => {
  console.log('Connected:', socket.id);
  
  // Join rooms after connection (for staff/owner)
  socket.emit('join-rooms');
});

socket.on('rooms-joined', (data) => {
  console.log('Successfully joined rooms:', data);
  // Now you can receive notifications
});
```

---

## Room Joining

### For Customers (QR Orders)

```javascript
// Join order room to track specific order
socket.emit('join-order', 'ORDER_ID_HERE');

// Join table room to track table status
socket.emit('join-table', 'TABLE_ID_HERE');
```

### For Staff/Owner

```javascript
// After connecting with token, emit join-rooms
socket.emit('join-rooms');

// You'll automatically join:
// - restaurant:{restaurantId}
// - service:{restaurantId} (for STAFF/OWNER)
// - kitchen:{restaurantId} (for CHEFF)
```

---

## Listening to Events

### Customer Events (QR Orders)

```javascript
// Order created
socket.on('order:created', (data) => {
  console.log('Order created:', data);
  // data: { orderId, orderNumber, orderStatus }
});

// Order status changed
socket.on('order:status-changed', (data) => {
  console.log('Order status:', data);
  // data: { orderId, orderStatus, paymentStatus }
});

// Items added to order
socket.on('order:item-added', (data) => {
  console.log('Items added:', data);
  // data: { orderId, newItems }
});

// Order completed
socket.on('order:completed', (data) => {
  console.log('Order completed:', data);
  // data: { orderId, orderStatus }
});

// Order cancelled
socket.on('order:cancelled', (data) => {
  console.log('Order cancelled:', data);
  // data: { orderId, orderStatus, reason }
});

// Table status changed
socket.on('table:status-changed', (data) => {
  console.log('Table status:', data);
  // data: { tableId, status, orderId }
});
```

### Staff/Owner Events

```javascript
// New order created
socket.on('order:new', (data) => {
  console.log('New order:', data);
  // data: { orderId, orderNumber, tableNumber, orderStatus, paymentStatus, orderTotal, items }
});

// Payment needs verification
socket.on('payment:needs-verification', (order) => {
  console.log('Payment verification needed:', order);
  // Full order object
});

// Order status changed
socket.on('order:status-changed', (data) => {
  console.log('Order status changed:', data);
  // data: { orderId, orderStatus, paymentStatus }
});

// Items added to existing order
socket.on('order:items-added', (data) => {
  console.log('Items added:', data);
  // data: { orderId, orderNumber, tableNumber, newItems, updatedTotal }
});

// Order cancelled
socket.on('order:cancelled', (data) => {
  console.log('Order cancelled:', data);
  // data: { orderId, orderNumber, tableNumber, orderStatus, reason }
});

// Order modified
socket.on('order:modified', (data) => {
  console.log('Order modified:', data);
  // data: { orderId, orderNumber, tableNumber, items, newTotal }
});

// Order needs attention
socket.on('order:needs-attention', (data) => {
  console.log('Order needs attention:', data);
  // data: { orderId, orderStatus, paymentStatus }
});
```

### Kitchen Staff Events

```javascript
// New order for kitchen
socket.on('order:new', (order) => {
  console.log('New order for kitchen:', order);
  // Full order object with items
});

// Order status changed (if CONFIRMED or PREPARING)
socket.on('order:status-changed', (data) => {
  console.log('Order status:', data);
  // data: { orderId, orderStatus, paymentStatus }
});
```

---

## Complete Example: Customer (QR Order)

```javascript
import io from 'socket.io-client';

class OrderTracking {
  constructor(orderId, tableId) {
    this.orderId = orderId;
    this.tableId = tableId;
    this.socket = null;
  }

  connect() {
    this.socket = io('http://localhost:3003', {
      autoConnect: true,
      reconnection: true,
    });

    this.socket.on('connect', () => {
      console.log('Connected to server');
      
      // Join order and table rooms
      this.socket.emit('join-order', this.orderId);
      this.socket.emit('join-table', this.tableId);
    });

    // Listen for order updates
    this.socket.on('order:status-changed', (data) => {
      this.handleStatusChange(data);
    });

    this.socket.on('order:completed', (data) => {
      this.handleOrderCompleted(data);
    });

    this.socket.on('table:status-changed', (data) => {
      this.handleTableStatusChange(data);
    });
  }

  handleStatusChange(data) {
    // Update UI with new order status
    console.log('Order status:', data.orderStatus);
  }

  handleOrderCompleted(data) {
    // Show completion message
    console.log('Order completed!');
  }

  handleTableStatusChange(data) {
    // Update table status in UI
    console.log('Table status:', data.status);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

// Usage
const tracker = new OrderTracking('ORDER_ID', 'TABLE_ID');
tracker.connect();
```

---

## Complete Example: Staff/Owner Dashboard

```javascript
import io from 'socket.io-client';

class StaffDashboard {
  constructor(token) {
    this.token = token;
    this.socket = null;
  }

  connect() {
    this.socket = io('http://localhost:3003', {
      auth: {
        token: this.token,
      },
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      console.log('Connected as staff');
      
      // Join staff rooms
      this.socket.emit('join-rooms');
    });

    this.socket.on('rooms-joined', () => {
      console.log('Joined staff rooms');
    });

    // Listen for all staff events
    this.socket.on('order:new', (data) => {
      this.handleNewOrder(data);
    });

    this.socket.on('payment:needs-verification', (order) => {
      this.handlePaymentVerification(order);
    });

    this.socket.on('order:status-changed', (data) => {
      this.handleStatusChange(data);
    });

    this.socket.on('order:items-added', (data) => {
      this.handleItemsAdded(data);
    });

    this.socket.on('order:cancelled', (data) => {
      this.handleOrderCancelled(data);
    });
  }

  handleNewOrder(data) {
    // Show notification: "New order #ORD-1"
    // Update orders list
  }

  handlePaymentVerification(order) {
    // Show notification: "Payment verification needed"
    // Highlight order in list
  }

  handleStatusChange(data) {
    // Update order status in UI
  }

  handleItemsAdded(data) {
    // Show notification: "Items added to order #ORD-1"
    // Update order total
  }

  handleOrderCancelled(data) {
    // Remove order from active list
    // Show notification
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

// Usage
const token = localStorage.getItem('accessToken');
const dashboard = new StaffDashboard(token);
dashboard.connect();
```

---

## React Hook Example

```javascript
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

export function useOrderTracking(orderId, tableId) {
  const [orderStatus, setOrderStatus] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const newSocket = io('http://localhost:3003');

    newSocket.on('connect', () => {
      newSocket.emit('join-order', orderId);
      newSocket.emit('join-table', tableId);
    });

    newSocket.on('order:status-changed', (data) => {
      setOrderStatus(data.orderStatus);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [orderId, tableId]);

  return { orderStatus, socket };
}

// Usage in component
function OrderPage({ orderId, tableId }) {
  const { orderStatus } = useOrderTracking(orderId, tableId);
  
  return <div>Order Status: {orderStatus}</div>;
}
```

---

## Important Notes

1. **Authentication**: 
   - Customers (QR orders): No token needed
   - Staff/Owner: Send JWT token in `auth.token` or via cookie

2. **Reconnection**: Socket.io automatically reconnects on disconnect

3. **Room Joining**: 
   - Customers: Join specific order/table rooms
   - Staff: Automatically join restaurant rooms after `join-rooms` event

4. **Event Names**: All events use the format `order:*` or `table:*`

5. **Error Handling**: Always listen for `error` and `disconnect` events

---

## Environment Variables

Make sure your backend has:
```env
FRONTEND_URL=http://localhost:3000  # Your frontend URL
PORT=3003  # Backend port
```

---

## Testing

You can test the connection in browser console:

```javascript
const socket = io('http://localhost:3003');
socket.on('connect', () => console.log('Connected!'));
socket.emit('join-order', 'YOUR_ORDER_ID');
socket.on('order:status-changed', (data) => console.log(data));
```

