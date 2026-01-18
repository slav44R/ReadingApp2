



import 'dart:io';
import 'package:flutter/material.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_tts/flutter_tts.dart';

void main() {
  runApp(const LectorAIApp());
}

class LectorAIApp extends StatelessWidget {
  const LectorAIApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Lector AI',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF050811),
        primaryColor: const Color(0xFF10A37F),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF0A0E1A),
          elevation: 4,
        ),
      ),
      home: const ChatScreen(),
    );
  }
}

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final TextRecognizer _textRecognizer = TextRecognizer(
    script: TextRecognitionScript.latin,
  );
  final FlutterTts _flutterTts = FlutterTts();
  final ScrollController _scrollController = ScrollController();

  final List<ChatMessage> _messages = [
    ChatMessage(
      text: "Здравей! Аз съм твоят помощник за четене на уроци.\n\n"
          "1. Избери език от менюто горе\n"
          "2. Качи снимка на текста или снимай директно\n"
          "3. Аз ще го разчета и ще ти го прочета на глас! 🎧",
      isUser: false,
      isImage: false,
    )
  ];

  bool _isReading = false;
  bool _isPaused = false;
  String _currentLang = 'bg-BG';

  @override
  void initState() {
    super.initState();
    _initTts();
  }

  @override
  void dispose() {
    _textRecognizer.close();
    _flutterTts.stop();
    _scrollController.dispose();
    super.dispose();
  }

  void _initTts() async {
    await _flutterTts.setLanguage(_currentLang);
    await _flutterTts.setPitch(1.0);
    await _flutterTts.setSpeechRate(0.9);
    _flutterTts.setCompletionHandler(() {
      setState(() {
        _isReading = false;
        _isPaused = false;
      });
    });
  }

  Future<void> _handleImageSelection(ImageSource source) async {
    try {
      final XFile? image = await ImagePicker().pickImage(source: source);
      if (image == null) return;
      _processImage(File(image.path));
    } catch (e) {
      _addBotMessage("Грешка: Не мога да достъпя камерата.");
    }
  }

  Future<void> _handleFileSelection() async {
    try {
      FilePickerResult? result = await FilePicker.platform.pickFiles(
        type: FileType.image,
      );
      if (result != null && result.files.single.path != null) {
        _processImage(File(result.files.single.path!));
      }
    } catch (e) {
      _addBotMessage("Грешка: Не мога да достъпя файловете.");
    }
  }

  void _processImage(File image) async {
    setState(() {
      _messages.add(ChatMessage(
        isUser: true,
        isImage: true,
        imageFile: image,
      ));
    });
    _scrollToBottom();

    setState(() {
      _messages.add(ChatMessage(
        text: "Анализирам текста...",
        isUser: false,
        isLoading: true,
      ));
    });
    _scrollToBottom();

    final inputImage = InputImage.fromFile(image);
    try {
      final RecognizedText recognizedText = 
          await _textRecognizer.processImage(inputImage);

      setState(() {
        _messages.removeLast();
      });

      String resultText = recognizedText.text.trim();
      if (resultText.isEmpty) {
        resultText = "Не открих ясен текст на тази снимка. "
            "Опитай с по-добра светлина или по-ясна снимка.";
      }

      _addBotMessage(resultText);
      _speak(resultText);
    } catch (e) {
      setState(() {
        if (_messages.isNotEmpty && _messages.last.isLoading == true) {
          _messages.removeLast();
        }
      });
      _addBotMessage(
        "Съжалявам, възникна грешка при четенето. Опитай с друга снимка.",
      );
    }
  }

  void _addBotMessage(String text) {
    setState(() {
      _messages.add(ChatMessage(text: text, isUser: false));
    });
    _scrollToBottom();
  }

  Future<void> _speak(String text) async {
    await _flutterTts.stop();
    setState(() {
      _isReading = true;
      _isPaused = false;
    });
    await _flutterTts.speak(text);
  }

  void _togglePause() async {
    if (_isPaused) {
      // Възобновяване
      await _flutterTts.speak(""); // Resume не работи добре, затова restart
      setState(() => _isPaused = false);
    } else {
      // Пауза
      await _flutterTts.pause();
      setState(() => _isPaused = true);
    }
  }

  void _stopSpeaking() async {
    await _flutterTts.stop();
    setState(() {
      _isReading = false;
      _isPaused = false;
    });
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                gradient: const LinearGradient(
                  colors: [Color(0xFF10A37F), Color(0xFF3B82F6), Color(0xFF8B5CF6)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF10A37F).withOpacity(0.4),
                    blurRadius: 20,
                    spreadRadius: 2,
                  ),
                ],
              ),
              child: const Center(
                child: Text('🤖', style: TextStyle(fontSize: 20)),
              ),
            ),
            const SizedBox(width: 12),
            const Text(
              'Lector AI',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 20,
              ),
            ),
          ],
        ),
        actions: [
          PopupMenuButton<String>(
            icon: Icon(
              _currentLang == 'bg-BG' ? Icons.language : Icons.translate,
              color: Colors.white70,
            ),
            onSelected: (value) {
              setState(() => _currentLang = value);
              _flutterTts.setLanguage(_currentLang);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    "Език променен на ${_currentLang == 'bg-BG' ? 'Български' : 'English'}",
                  ),
                  duration: const Duration(seconds: 1),
                ),
              );
            },
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: 'bg-BG',
                child: Row(
                  children: [
                    Text('🇧🇬', style: TextStyle(fontSize: 20)),
                    SizedBox(width: 10),
                    Text('Български'),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'en-US',
                child: Row(
                  children: [
                    Text('🇺🇸', style: TextStyle(fontSize: 20)),
                    SizedBox(width: 10),
                    Text('English'),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(0.15, -0.85),
                  radius: 1.5,
                  colors: [
                    const Color(0xFF10A37F).withOpacity(0.15),
                    Colors.transparent,
                  ],
                ),
              ),
              child: ListView.builder(
                controller: _scrollController,
                padding: const EdgeInsets.all(20),
                itemCount: _messages.length,
                itemBuilder: (context, index) => _messages[index],
              ),
            ),
          ),

          // Control Buttons
          if (_isReading)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Pause/Resume Button
                  ElevatedButton.icon(
                    onPressed: _togglePause,
                    icon: Icon(_isPaused ? Icons.play_arrow : Icons.pause),
                    label: Text(_isPaused ? 'ПРОДЪЛЖИ' : 'ПАУЗА'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _isPaused
                          ? const Color(0xFF10A37F).withOpacity(0.2)
                          : Colors.yellow.withOpacity(0.2),
                      foregroundColor: _isPaused
                          ? const Color(0xFF10A37F)
                          : Colors.yellow,
                      side: BorderSide(
                        color: _isPaused
                            ? const Color(0xFF10A37F)
                            : Colors.yellow,
                        width: 2,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(30),
                      ),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 24,
                        vertical: 12,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  // Stop Button
                  ElevatedButton.icon(
                    onPressed: _stopSpeaking,
                    icon: const Icon(Icons.stop),
                    label: const Text('СПРИ'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.red.withOpacity(0.2),
                      foregroundColor: Colors.red,
                      side: const BorderSide(color: Colors.red, width: 2),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(30),
                      ),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 24,
                        vertical: 12,
                      ),
                    ),
                  ),
                ],
              ),
            ),

          // Input Area
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF0F1423).withOpacity(0.85),
              border: Border(
                top: BorderSide(
                  color: Colors.white.withOpacity(0.08),
                ),
              ),
            ),
            child: SafeArea(
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF1A1F2E).withOpacity(0.8),
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(
                    color: Colors.white.withOpacity(0.08),
                  ),
                ),
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.add, size: 28),
                      color: const Color(0xFF10A37F),
                      onPressed: _handleFileSelection,
                      tooltip: 'Качи снимка',
                    ),
                    const Expanded(
                      child: Padding(
                        padding: EdgeInsets.symmetric(horizontal: 12),
                        child: Text(
                          'Качи снимка на текст...',
                          style: TextStyle(
                            color: Color(0xFF8B92B0),
                            fontSize: 15,
                          ),
                        ),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.camera_alt, size: 28),
                      color: const Color(0xFF3B82F6),
                      onPressed: () => _handleImageSelection(ImageSource.camera),
                      tooltip: 'Снимай',
                    ),
                    const SizedBox(width: 4),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// Message Widget
class ChatMessage extends StatelessWidget {
  final String? text;
  final bool isUser;
  final bool isImage;
  final File? imageFile;
  final bool isLoading;

  const ChatMessage({
    super.key,
    this.text,
    required this.isUser,
    this.isImage = false,
    this.imageFile,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Avatar
          Container(
            width: 38,
            height: 38,
            margin: const EdgeInsets.only(right: 14),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: isUser
                    ? [
                        const Color(0xFF8B5CF6).withOpacity(0.3),
                        const Color(0xFF3B82F6).withOpacity(0.2),
                      ]
                    : [
                        const Color(0xFF10A37F).withOpacity(0.3),
                        const Color(0xFF3B82F6).withOpacity(0.2),
                      ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isUser
                    ? const Color(0xFF8B5CF6).withOpacity(0.4)
                    : const Color(0xFF10A37F).withOpacity(0.4),
              ),
              boxShadow: [
                BoxShadow(
                  color: isUser
                      ? const Color(0xFF8B5CF6).withOpacity(0.2)
                      : const Color(0xFF10A37F).withOpacity(0.2),
                  blurRadius: 12,
                  spreadRadius: 2,
                ),
              ],
            ),
            child: Icon(
              isUser ? Icons.person : Icons.auto_awesome,
              color: Colors.white,
              size: 20,
            ),
          ),

          // Content
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Label
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: isUser
                              ? const Color(0xFF8B5CF6)
                              : const Color(0xFF10A37F),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        isUser ? 'YOU' : 'LECTOR AI',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 11,
                          letterSpacing: 0.8,
                          color: const Color(0xFF8B92B0).withOpacity(0.8),
                        ),
                      ),
                    ],
                  ),
                ),

                // Message Content
                if (isLoading)
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1A1F2E).withOpacity(0.8),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(
                        color: const Color(0xFF10A37F).withOpacity(0.2),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              const Color(0xFF10A37F),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Text(
                          text ?? 'Зареждам...',
                          style: TextStyle(
                            color: const Color(0xFF8B92B0),
                            fontStyle: FontStyle.italic,
                          ),
                        ),
                      ],
                    ),
                  ),

                if (isImage && imageFile != null)
                  Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(
                        color: const Color(0xFF10A37F).withOpacity(0.3),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.4),
                          blurRadius: 20,
                          spreadRadius: 2,
                        ),
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(18),
                      child: Image.file(
                        imageFile!,
                        height: 200,
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),

                if (!isImage && !isLoading)
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: isUser
                            ? [
                                const Color(0xFF8B5CF6).withOpacity(0.12),
                                const Color(0xFF3B82F6).withOpacity(0.08),
                              ]
                            : [
                                const Color(0xFF0F1423).withOpacity(0.9),
                                const Color(0xFF10A37F).withOpacity(0.05),
                              ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(18).copyWith(
                        topLeft: isUser
                            ? const Radius.circular(18)
                            : const Radius.circular(6),
                        topRight: isUser
                            ? const Radius.circular(6)
                            : const Radius.circular(18),
                      ),
                      border: Border.all(
                        color: isUser
                            ? const Color(0xFF8B5CF6).withOpacity(0.25)
                            : const Color(0xFF10A37F).withOpacity(0.2),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.3),
                          blurRadius: 16,
                          spreadRadius: 0,
                        ),
                      ],
                    ),
                    child: Text(
                      text ?? '',
                      style: const TextStyle(
                        color: Color(0xFFE8ECFF),
                        height: 1.6,
                        fontSize: 15,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}