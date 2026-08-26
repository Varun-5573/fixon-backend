import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../utils/constants.dart';

class CartItem {
  final Map<String, dynamic> part;
  int quantity;

  CartItem({required this.part, this.quantity = 1});

  double get price {
    final p = part['discountPrice'] != null && (part['discountPrice'] as num) < (part['price'] as num)
        ? (part['discountPrice'] as num).toDouble()
        : (part['price'] as num).toDouble();
    return p;
  }

  double get total => price * quantity;
}

class SparePartsProvider with ChangeNotifier {
  List<dynamic> _spareParts = [];
  List<dynamic> _categories = [];
  List<dynamic> _myOrders = [];
  final List<CartItem> _cart = [];
  bool _isLoading = false;
  String _selectedCategory = 'All';
  String _searchQuery = '';
  IO.Socket? _socket;

  List<dynamic> get spareParts => _spareParts;
  List<dynamic> get categories => _categories;
  List<dynamic> get myOrders => _myOrders;
  List<CartItem> get cart => List.unmodifiable(_cart);
  bool get isLoading => _isLoading;
  String get selectedCategory => _selectedCategory;
  String get searchQuery => _searchQuery;

  double get cartSubtotal => _cart.fold(0.0, (sum, item) => sum + item.total);
  double get cartDelivery => _cart.fold(0.0, (sum, item) => sum + ((item.part['deliveryCharge'] as num?)?.toDouble() ?? 40.0));
  double get cartGrandTotal => cartSubtotal + cartDelivery;
  int get cartCount => _cart.fold(0, (sum, item) => sum + item.quantity);

  SparePartsProvider() {
    fetchCategories();
    fetchSpareParts();
  }

  IO.Socket? get socket => _socket;

  void initSocketSync(String customerId) {
    if (_socket != null) return;
    try {
      _socket = IO.io(
        kBaseUrl,
        IO.OptionBuilder()
            .setTransports(['websocket', 'polling'])
            .enableAutoConnect()
            .enableReconnection()
            .setReconnectionDelay(1000)
            .build(),
      );

      _socket!.on('connect', (_) {
        debugPrint('🔌 SparePartsProvider: Socket connected');
        _socket!.emit('customer_join', {'userId': customerId});
      });

      _socket!.on('spare_part_order_status_updated', (data) {
        if (data != null && data is Map) {
          final orderId = data['orderId'];
          final newStatus = data['status'];
          final orderObj = data['order'];
          _updateLocalOrder(orderId, newStatus, orderObj);
        }
      });

      _socket!.on('spare_part_order_update', (data) {
        if (data != null && data is Map) {
          final orderId = data['orderId'];
          final newStatus = data['status'];
          final orderObj = data['order'];
          _updateLocalOrder(orderId, newStatus, orderObj);
        }
      });

      _socket!.on('spare_part_delivery_location', (data) {
        if (data != null && data is Map) {
          final orderId = data['orderId'];
          final lat = (data['latitude'] ?? data['lat'] as num?)?.toDouble();
          final lng = (data['longitude'] ?? data['lng'] as num?)?.toDouble();
          final ts = data['timestamp'];
          _updateOrderLocation(orderId, lat, lng, ts);
        }
      });
    } catch (e) {
      debugPrint('Error in SparePartsProvider socket: $e');
    }
  }

  void _updateOrderLocation(dynamic orderId, double? lat, double? lng, dynamic ts) {
    final index = _myOrders.indexWhere((o) =>
        o['orderId'] == orderId ||
        o['_id'] == orderId ||
        o['lookupId'] == orderId ||
        (orderId != null && o['orderId']?.toString().replaceAll('#', '') == orderId.toString().replaceAll('#', ''))
    );

    if (index != -1 && lat != null && lng != null) {
      _myOrders[index]['workerLatitude'] = lat;
      _myOrders[index]['workerLongitude'] = lng;
      _myOrders[index]['lastLocationUpdate'] = ts;
      notifyListeners();
    }
  }


  void _updateLocalOrder(dynamic orderId, dynamic newStatus, dynamic orderObj) {
    final index = _myOrders.indexWhere((o) =>
        o['orderId'] == orderId ||
        o['_id'] == orderId ||
        o['lookupId'] == orderId ||
        (orderId != null && o['orderId']?.toString().replaceAll('#', '') == orderId.toString().replaceAll('#', ''))
    );

    if (index != -1) {
      if (orderObj != null && orderObj is Map) {
        _myOrders[index] = Map<String, dynamic>.from(orderObj);
      } else {
        _myOrders[index]['orderStatus'] = newStatus;
        if (newStatus == 'DELIVERED') {
          _myOrders[index]['paymentStatus'] = 'PAID';
        }
      }
      notifyListeners();
    }
  }

  void setCategory(String category) {
    _selectedCategory = category;
    notifyListeners();
    fetchSpareParts();
  }

  void setSearchQuery(String query) {
    _searchQuery = query;
    notifyListeners();
    fetchSpareParts();
  }

  Future<void> fetchCategories() async {
    try {
      final res = await http.get(Uri.parse('$kBaseUrl/api/spare-parts/categories'));
      if (res.statusCode == 200) {
        final data = json.decode(res.body);
        if (data['success'] == true && data['categories'] != null) {
          _categories = data['categories'];
          notifyListeners();
        }
      }
    } catch (e) {
      debugPrint('Error fetching categories: $e');
    }
  }

  Future<void> fetchSpareParts() async {
    _isLoading = true;
    notifyListeners();

    try {
      final queryParams = <String, String>{};
      if (_selectedCategory != 'All') queryParams['category'] = _selectedCategory;
      if (_searchQuery.isNotEmpty) queryParams['search'] = _searchQuery;

      final uri = Uri.parse('$kBaseUrl/api/spare-parts').replace(queryParameters: queryParams);
      final res = await http.get(uri);

      if (res.statusCode == 200) {
        final data = json.decode(res.body);
        if (data['success'] == true && data['spareParts'] != null) {
          _spareParts = data['spareParts'];
        }
      }
    } catch (e) {
      debugPrint('Error fetching spare parts: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void addToCart(Map<String, dynamic> part, {int qty = 1}) {
    final existingIndex = _cart.indexWhere((item) => item.part['_id'] == part['_id']);
    if (existingIndex >= 0) {
      _cart[existingIndex].quantity += qty;
    } else {
      _cart.add(CartItem(part: part, quantity: qty));
    }
    notifyListeners();
  }

  void updateCartQty(String partId, int newQty) {
    final idx = _cart.indexWhere((item) => item.part['_id'] == partId);
    if (idx >= 0) {
      if (newQty <= 0) {
        _cart.removeAt(idx);
      } else {
        _cart[idx].quantity = newQty;
      }
      notifyListeners();
    }
  }

  void removeFromCart(String partId) {
    _cart.removeWhere((item) => item.part['_id'] == partId);
    notifyListeners();
  }

  void clearCart() {
    _cart.clear();
    notifyListeners();
  }

  Future<Map<String, dynamic>> placeOrder({
    required String customerId,
    required String customerName,
    required String customerPhone,
    required dynamic deliveryAddress,
    bool comboWithTechnician = false,
    double installationFee = 299.0,
  }) async {
    if (_cart.isEmpty) {
      return {'success': false, 'message': 'Cart is empty'};
    }

    try {
      final itemsList = _cart.map((item) => {
        'partId': item.part['_id'],
        'partName': item.part['name'],
        'quantity': item.quantity,
      }).toList();

      final body = json.encode({
        'customerId': customerId,
        'customerName': customerName,
        'customerPhone': customerPhone,
        'items': itemsList,
        'deliveryAddress': deliveryAddress,
        'comboWithTechnician': comboWithTechnician,
        'installationFee': installationFee,
      });

      final res = await http.post(
        Uri.parse('$kBaseUrl/api/spare-part-orders'),
        headers: {'Content-Type': 'application/json'},
        body: body,
      );

      final data = json.decode(res.body);
      if (res.statusCode == 200 && data['success'] == true) {
        clearCart();
        fetchMyOrders(customerId);
        fetchSpareParts(); // Refresh stock
        return {'success': true, 'order': data['order'], 'message': data['message']};
      } else {
        return {'success': false, 'message': data['message'] ?? 'Order failed'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  Future<void> fetchMyOrders(String customerId) async {
    initSocketSync(customerId);
    try {
      final res = await http.get(
        Uri.parse('$kBaseUrl/api/spare-part-orders/my?customerId=$customerId'),
      );
      if (res.statusCode == 200) {
        final data = json.decode(res.body);
        if (data['success'] == true && data['orders'] != null) {
          _myOrders = data['orders'];
          notifyListeners();
        }
      }
    } catch (e) {
      debugPrint('Error fetching my orders: $e');
    }
  }
}

