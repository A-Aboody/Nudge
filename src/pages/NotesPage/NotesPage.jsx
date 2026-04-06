import {
  Box,
  Flex,
  Text,
  VStack,
  HStack,
  Icon,
  Button,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Badge,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  useDisclosure,
  useBreakpointValue,
} from "@chakra-ui/react";
import {
  FiPlus,
  FiSearch,
  FiTrash2,
  FiArrowLeft,
  FiFileText,
  FiX,
  FiCheck,
  FiBold,
  FiItalic,
  FiUnderline,
  FiAlignLeft,
  FiAlignCenter,
  FiAlignRight,
  FiList,
  FiClock,
  FiAlertCircle,
  FiChevronDown,
  FiCalendar,
  FiCheckSquare,
} from "react-icons/fi";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { readEvents, readTodos, linkNoteToEvent, linkNoteToTodo } from "../../utils/linkHelpers";
import { useAuth } from "../../context/AuthContext";
import { loadNotes as dbLoadNotes, saveNotes as dbSaveNotes, loadCategories as dbLoadCategories, saveCategories as dbSaveCategories } from "../../services/db";

const SMART_VIEWS = [
  { key: "recent", label: "Recent", icon: FiClock },
  { key: "stale", label: "Stale", icon: FiAlertCircle },
];

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function stripHtml(html) {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;

const NotesPage = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [notes, setNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState(null);
  const [tagInput, setTagInput] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [storedCategories, setStoredCategories] = useState([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [isContentEmpty, setIsContentEmpty] = useState(true);
  const [activeFormats, setActiveFormats] = useState({});
  const [contextMenu, setContextMenu] = useState(null);

  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const { isOpen: isCatOpen, onOpen: onCatOpen, onClose: onCatClose } = useDisclosure();
  const { isOpen: isFilterOpen, onOpen: onFilterOpen, onClose: onFilterClose } = useDisclosure();
  const { isOpen: isLinkEventOpen, onOpen: onLinkEventOpen, onClose: onLinkEventClose } = useDisclosure();
  const { isOpen: isLinkTodoOpen, onOpen: onLinkTodoOpen, onClose: onLinkTodoClose } = useDisclosure();
  const [linkEventSearch, setLinkEventSearch] = useState("");
  const [linkTodoSearch, setLinkTodoSearch] = useState("");
  const cancelRef = useRef();
  const titleRef = useRef();
  const editorRef = useRef();
  const contentSaveTimer = useRef(null);
  const storageSaveTimer = useRef(null);
  const initializedRef = useRef(false);
  const initialLoadDone = useRef(false);
  const isDesktop = useBreakpointValue({ base: false, lg: true });

  // Close context menu on click / scroll / escape / right-click elsewhere
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [contextMenu]);

  const handleContextMenu = useCallback((e, note) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, item: note });
  }, []);

  // Merge stored categories + categories found on notes
  const allCategories = useMemo(() => {
    const cats = new Set(storedCategories);
    notes.forEach((n) => {
      if (n.category && n.category.trim()) cats.add(n.category.trim());
    });
    return Array.from(cats).sort();
  }, [notes, storedCategories]);

  // Load from Firestore on mount
  useEffect(() => {
    if (!user) return;
    Promise.all([dbLoadNotes(user.uid), dbLoadCategories(user.uid, "note")]).then(([n, c]) => {
      setNotes(n);
      setStoredCategories(c);
      initialLoadDone.current = true;
    });
  }, [user]);

  // Persist stored categories
  useEffect(() => {
    if (!user || !initialLoadDone.current) return;
    dbSaveCategories(user.uid, "note", storedCategories);
  }, [storedCategories, user]);

  // Derived
  const activeNote = notes.find((n) => n.id === activeNoteId) || null;

  const filteredNotes = useMemo(() => {
    const now = Date.now();
    return notes
      .filter((n) => {
        const text = stripHtml(n.content);
        const matchesSearch =
          !searchTerm ||
          n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          text.toLowerCase().includes(searchTerm.toLowerCase()) ||
          n.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()));
        if (!matchesSearch) return false;

        // Smart view filters
        if (activeFilter === "All") return true;
        if (activeFilter === "recent") {
          return now - new Date(n.updatedAt).getTime() <= SEVEN_DAYS;
        }
        if (activeFilter === "stale") {
          return now - new Date(n.updatedAt).getTime() > FOURTEEN_DAYS;
        }
        // Category filter
        return n.category === activeFilter;
      })
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }, [notes, searchTerm, activeFilter]);

  // Handle URL params on mount (from dashboard clicks)
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const noteId = searchParams.get("id");
    const isNew = searchParams.get("new");

    if (isNew) {
      // Create a new note immediately
      const now = new Date().toISOString();
      const note = {
        id: Date.now(),
        title: "",
        content: "",
        category: "",
        tags: [],
        linkedEventIds: [],
        linkedTodoIds: [],
        createdAt: now,
        updatedAt: now,
      };
      setNotes((prev) => [note, ...prev]);
      setActiveNoteId(note.id);
      setMobileEditorOpen(true);
      setTimeout(() => titleRef.current?.focus(), 100);
      setSearchParams({}, { replace: true });
    } else if (noteId) {
      const id = Number(noteId);
      const found = notes.find((n) => n.id === id);
      if (found) {
        setActiveNoteId(id);
        setMobileEditorOpen(true);
      }
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist to Firestore (debounced)
  useEffect(() => {
    if (!user || !initialLoadDone.current) return;
    if (storageSaveTimer.current) clearTimeout(storageSaveTimer.current);
    storageSaveTimer.current = setTimeout(() => dbSaveNotes(user.uid, notes), 500);
    return () => {
      if (storageSaveTimer.current) clearTimeout(storageSaveTimer.current);
    };
  }, [notes, user]);

  // Sync editor fields when active note changes
  useEffect(() => {
    if (activeNote) {
      setDraftTitle(activeNote.title);
      setTagInput(activeNote.tags.join(", "));
      setIsContentEmpty(!activeNote.content || !stripHtml(activeNote.content).trim());
      if (editorRef.current) {
        editorRef.current.innerHTML = activeNote.content || "";
      }
    } else {
      setDraftTitle("");
      setTagInput("");
      setIsContentEmpty(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNoteId]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (contentSaveTimer.current) clearTimeout(contentSaveTimer.current);
      if (storageSaveTimer.current) clearTimeout(storageSaveTimer.current);
    };
  }, []);

  // Track active formatting at cursor position
  const checkActiveFormats = useCallback(() => {
    if (!editorRef.current || (!editorRef.current.contains(document.activeElement) &&
        !editorRef.current.contains(window.getSelection()?.anchorNode))) {
      return;
    }
    setActiveFormats({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      justifyLeft: document.queryCommandState("justifyLeft"),
      justifyCenter: document.queryCommandState("justifyCenter"),
      justifyRight: document.queryCommandState("justifyRight"),
      insertUnorderedList: document.queryCommandState("insertUnorderedList"),
    });
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", checkActiveFormats);
    return () => document.removeEventListener("selectionchange", checkActiveFormats);
  }, [checkActiveFormats]);

  // -- Content save with debounce --
  const scheduleContentSave = useCallback((noteId, html) => {
    if (contentSaveTimer.current) clearTimeout(contentSaveTimer.current);
    contentSaveTimer.current = setTimeout(() => {
      setNotes((prev) =>
        prev.map((n) =>
          n.id === noteId ? { ...n, content: html, updatedAt: new Date().toISOString() } : n
        )
      );
      contentSaveTimer.current = null;
    }, 300);
  }, []);

  const flushContentSave = useCallback(() => {
    if (!contentSaveTimer.current) return;
    clearTimeout(contentSaveTimer.current);
    contentSaveTimer.current = null;
    if (editorRef.current && activeNoteId) {
      const el = editorRef.current;
      const text = el.textContent || "";
      const html = text.trim() ? el.innerHTML : "";
      setNotes((prev) =>
        prev.map((n) =>
          n.id === activeNoteId ? { ...n, content: html, updatedAt: new Date().toISOString() } : n
        )
      );
    }
  }, [activeNoteId]);

  // -- Handlers --
  const handleTitleChange = (e) => {
    const value = e.target.value;
    setDraftTitle(value);
    setNotes((prev) =>
      prev.map((n) =>
        n.id === activeNoteId ? { ...n, title: value, updatedAt: new Date().toISOString() } : n
      )
    );
  };

  const handleContentInput = () => {
    const el = editorRef.current;
    if (!el || !activeNoteId) return;
    const text = el.textContent || "";
    setIsContentEmpty(!text.trim());
    const html = text.trim() ? el.innerHTML : "";
    scheduleContentSave(activeNoteId, html);
  };

  const handleFormat = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    checkActiveFormats();
    if (editorRef.current && activeNoteId) {
      const el = editorRef.current;
      const text = el.textContent || "";
      const html = text.trim() ? el.innerHTML : "";
      scheduleContentSave(activeNoteId, html);
    }
  };

  const HIGHLIGHT_COLOR = "#7f9269";

  const isHighlightActive = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    let node = sel.anchorNode;
    while (node && node !== editorRef.current) {
      if (node.nodeType === 1 && node.style && node.style.backgroundColor &&
          node.style.backgroundColor !== "transparent") {
        return true;
      }
      node = node.parentNode;
    }
    return false;
  };

  const handleHighlightToggle = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    if (isHighlightActive()) {
      document.execCommand("hiliteColor", false, "transparent");
    } else {
      document.execCommand("hiliteColor", false, HIGHLIGHT_COLOR);
    }

    editorRef.current?.focus();
    checkActiveFormats();
    if (editorRef.current && activeNoteId) {
      const el = editorRef.current;
      const text = el.textContent || "";
      const html = text.trim() ? el.innerHTML : "";
      scheduleContentSave(activeNoteId, html);
    }
  };

  const handleSelectNote = (id) => {
    if (id === activeNoteId) {
      // Already selected — on mobile, ensure editor opens
      if (!isDesktop) setMobileEditorOpen(true);
      return;
    }
    flushContentSave();
    setActiveNoteId(id);
    setMobileEditorOpen(true);
  };

  const handleCreateNote = () => {
    flushContentSave();
    const now = new Date().toISOString();
    const note = {
      id: Date.now(),
      title: "",
      content: "",
      category: "",
      tags: [],
      linkedEventIds: [],
      linkedTodoIds: [],
      createdAt: now,
      updatedAt: now,
    };
    setNotes((prev) => [note, ...prev]);
    setActiveNoteId(note.id);
    setMobileEditorOpen(true);
    setTimeout(() => titleRef.current?.focus(), 50);
  };

  const handleBackToList = () => {
    flushContentSave();
    setMobileEditorOpen(false);
  };

  const handleDeleteConfirm = () => {
    if (!noteToDelete) return;
    const deletedId = noteToDelete.id;
    const remaining = notes.filter((n) => n.id !== deletedId);
    const nextId = remaining.length > 0 ? remaining[0].id : null;
    setNotes(remaining);
    if (activeNoteId === deletedId) {
      setActiveNoteId(nextId);
      if (!nextId) setMobileEditorOpen(false);
    }
    setNoteToDelete(null);
    onDeleteClose();
  };

  const assignCategory = (cat) => {
    if (!activeNoteId) return;
    // Persist the category to stored list
    if (cat && !storedCategories.includes(cat)) {
      setStoredCategories((prev) => [...prev, cat]);
    }
    setNotes((prev) =>
      prev.map((n) =>
        n.id === activeNoteId ? { ...n, category: cat, updatedAt: new Date().toISOString() } : n
      )
    );
    setCategorySearch("");
    onCatClose();
  };

  const deleteCategory = (cat) => {
    // Remove from stored list
    setStoredCategories((prev) => prev.filter((c) => c !== cat));
    // Clear from any notes that have it
    setNotes((prev) =>
      prev.map((n) => (n.category === cat ? { ...n, category: "" } : n))
    );
    // If we were filtering by this category, reset to All
    if (activeFilter === cat) setActiveFilter("All");
  };

  // Categories filtered by popover search, sorted alphabetically
  const filteredCategoryOptions = useMemo(() => {
    const term = categorySearch.trim().toLowerCase();
    return term ? allCategories.filter((c) => c.toLowerCase().includes(term)) : allCategories;
  }, [allCategories, categorySearch]);

  const categorySearchTrimmed = categorySearch.trim();
  const showCreateOption = categorySearchTrimmed && !allCategories.some(
    (c) => c.toLowerCase() === categorySearchTrimmed.toLowerCase()
  );

  // Filter dropdown options
  const filteredFilterOptions = useMemo(() => {
    const term = filterSearch.trim().toLowerCase();
    return term ? allCategories.filter((c) => c.toLowerCase().includes(term)) : allCategories;
  }, [allCategories, filterSearch]);

  // Cached events/todos for link popovers
  const [cachedEvents, setCachedEvents] = useState([]);
  const [cachedTodos, setCachedTodos] = useState([]);

  useEffect(() => {
    if (!user || !isLinkEventOpen) return;
    readEvents(user.uid).then(setCachedEvents);
  }, [user, isLinkEventOpen]);

  useEffect(() => {
    if (!user || !isLinkTodoOpen) return;
    readTodos(user.uid).then(setCachedTodos);
  }, [user, isLinkTodoOpen]);

  const availableEvents = useMemo(() => {
    const term = linkEventSearch.trim().toLowerCase();
    return term ? cachedEvents.filter((e) => (e.title || "").toLowerCase().includes(term)) : cachedEvents;
  }, [linkEventSearch, cachedEvents]);

  const availableTodos = useMemo(() => {
    const term = linkTodoSearch.trim().toLowerCase();
    return term ? cachedTodos.filter((t) => (t.title || "").toLowerCase().includes(term)) : cachedTodos;
  }, [linkTodoSearch, cachedTodos]);

  const handleLinkEvent = (eventId) => {
    if (!activeNoteId || !user) return;
    linkNoteToEvent(user.uid, activeNoteId, eventId);
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id === activeNoteId) {
          const ids = n.linkedEventIds || [];
          if (!ids.includes(eventId)) return { ...n, linkedEventIds: [...ids, eventId], updatedAt: new Date().toISOString() };
        }
        return n;
      })
    );
  };

  const handleLinkTodo = (todoId) => {
    if (!activeNoteId || !user) return;
    linkNoteToTodo(user.uid, activeNoteId, todoId);
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id === activeNoteId) {
          const ids = n.linkedTodoIds || [];
          if (!ids.includes(todoId)) return { ...n, linkedTodoIds: [...ids, todoId], updatedAt: new Date().toISOString() };
        }
        return n;
      })
    );
  };

  const handleTagInputBlur = () => {
    if (!activeNoteId) return;
    const tags = tagInput.split(",").map((t) => t.trim()).filter(Boolean);
    setNotes((prev) =>
      prev.map((n) =>
        n.id === activeNoteId ? { ...n, tags, updatedAt: new Date().toISOString() } : n
      )
    );
  };

  const handleTagInputKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleTagInputBlur();
      editorRef.current?.focus();
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    if (!activeNote) return;
    const newTags = activeNote.tags.filter((t) => t !== tagToRemove);
    setTagInput(newTags.join(", "));
    setNotes((prev) =>
      prev.map((n) =>
        n.id === activeNoteId ? { ...n, tags: newTags, updatedAt: new Date().toISOString() } : n
      )
    );
  };

  // -- Layout flags --
  const showList = isDesktop || !mobileEditorOpen;
  const showEditor = isDesktop || mobileEditorOpen;

  const handleFilterSelect = (key) => {
    setActiveFilter(key);
    setFilterSearch("");
    onFilterClose();
  };

  return (
    <Flex h={{ base: "calc(100vh - 70px)", md: "100vh" }} overflow="hidden">
      {/* ========== NOTE LIST PANEL ========== */}
      {showList && (
        <Flex
          direction="column"
          h="100%"
          w={{ base: "100%", lg: "300px" }}
          minW={{ lg: "300px" }}
          borderRight={{ lg: "1px solid #333333" }}
          bg="background"
        >
          {/* Header */}
          <Flex px={5} pt={5} pb={3} justify="space-between" align="center">
            <Text fontSize="lg" fontWeight="700" color="text" letterSpacing="-0.02em">
              Notes
            </Text>
            <IconButton
              icon={<FiPlus />}
              size="sm"
              variant="ghost"
              color="text.secondary"
              _hover={{ bg: "bg.hover", color: "text" }}
              aria-label="New note"
              onClick={handleCreateNote}
              borderRadius="6px"
            />
          </Flex>

          {/* Search */}
          <Box px={4} pb={2}>
            <InputGroup size="sm">
              <InputLeftElement pointerEvents="none">
                <Icon as={FiSearch} color="text.tertiary" boxSize="14px" />
              </InputLeftElement>
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                borderRadius="6px"
                fontSize="sm"
                bg="bg.surface"
                border="1px solid"
                borderColor="border"
                _placeholder={{ color: "text.tertiary" }}
              />
            </InputGroup>
          </Box>

          {/* Filter dropdown */}
          <Box px={4} pb={3}>
            <Popover
              isOpen={isFilterOpen}
              onOpen={() => { setFilterSearch(""); onFilterOpen(); }}
              onClose={onFilterClose}
              placement="bottom-start"
              isLazy
            >
              <PopoverTrigger>
                <Button
                  size="sm"
                  variant="ghost"
                  bg="bg.surface"
                  border="1px solid"
                  borderColor="border"
                  color="text.secondary"
                  borderRadius="6px"
                  fontWeight="500"
                  fontSize="xs"
                  px={3}
                  _hover={{ bg: "bg.hover" }}
                  rightIcon={<Icon as={FiChevronDown} boxSize="12px" />}
                  w="full"
                  justifyContent="space-between"
                >
                  {activeFilter === "All"
                    ? "All Notes"
                    : SMART_VIEWS.find((sv) => sv.key === activeFilter)?.label || activeFilter}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                w="260px"
                bg="background"
                borderColor="border"
                borderRadius="8px"
                shadow="0 8px 24px rgba(0,0,0,0.15)"
                _focus={{ outline: "none" }}
              >
                <PopoverBody p={2}>
                  {allCategories.length > 4 && (
                    <Input
                      placeholder="Search categories..."
                      size="xs"
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                      mb={2}
                      borderRadius="4px"
                      fontSize="xs"
                      autoFocus
                    />
                  )}
                  <VStack align="stretch" spacing={0} maxH="260px" overflowY="auto">
                    {/* All option */}
                    <Flex
                      px={2}
                      py={1.5}
                      cursor="pointer"
                      borderRadius="4px"
                      _hover={{ bg: "bg.hover" }}
                      align="center"
                      justify="space-between"
                      onClick={() => handleFilterSelect("All")}
                    >
                      <Text fontSize="xs" color="text" fontWeight={activeFilter === "All" ? "600" : "400"}>
                        All Notes
                      </Text>
                      {activeFilter === "All" && <Icon as={FiCheck} boxSize="12px" color="primary" />}
                    </Flex>

                    {/* Smart views */}
                    {SMART_VIEWS.map((sv) => (
                      <Flex
                        key={sv.key}
                        px={2}
                        py={1.5}
                        cursor="pointer"
                        borderRadius="4px"
                        _hover={{ bg: "bg.hover" }}
                        align="center"
                        justify="space-between"
                        onClick={() => handleFilterSelect(sv.key)}
                      >
                        <HStack spacing={1.5}>
                          <Icon as={sv.icon} boxSize="11px" color="text.tertiary" />
                          <Text fontSize="xs" color="text" fontWeight={activeFilter === sv.key ? "600" : "400"}>
                            {sv.label}
                          </Text>
                        </HStack>
                        {activeFilter === sv.key && <Icon as={FiCheck} boxSize="12px" color="primary" />}
                      </Flex>
                    ))}

                    {/* Divider between smart views and categories */}
                    {filteredFilterOptions.length > 0 && (
                      <Box h="1px" bg="border" my={1.5} mx={1} />
                    )}

                    {/* Category options */}
                    {filteredFilterOptions.map((cat) => (
                      <Flex
                        key={cat}
                        px={2}
                        py={1.5}
                        cursor="pointer"
                        borderRadius="4px"
                        _hover={{ bg: "bg.hover" }}
                        align="center"
                        justify="space-between"
                        onClick={() => handleFilterSelect(cat)}
                      >
                        <Text
                          fontSize="xs"
                          color="text"
                          fontWeight={activeFilter === cat ? "600" : "400"}
                          noOfLines={1}
                          flex={1}
                        >
                          {cat}
                        </Text>
                        <HStack spacing={1}>
                          {activeFilter === cat && <Icon as={FiCheck} boxSize="12px" color="primary" />}
                          <IconButton
                            icon={<FiX />}
                            size="xs"
                            variant="ghost"
                            color="text.tertiary"
                            _hover={{ color: "red.400", bg: "transparent" }}
                            aria-label={`Delete ${cat}`}
                            minW="18px"
                            h="18px"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteCategory(cat);
                            }}
                          />
                        </HStack>
                      </Flex>
                    ))}

                    {/* No categories message */}
                    {allCategories.length === 0 && (
                      <Text fontSize="xs" color="text.tertiary" px={2} py={1.5} fontStyle="italic">
                        No categories yet
                      </Text>
                    )}
                  </VStack>
                </PopoverBody>
              </PopoverContent>
            </Popover>
          </Box>

          {/* Note items */}
          <VStack spacing={0.5} align="stretch" flex={1} overflowY="auto" pb={4}>
            {filteredNotes.length === 0 ? (
              <VStack py={10} spacing={2}>
                <Icon as={FiFileText} boxSize={8} color="text.tertiary" />
                <Text fontSize="sm" color="text.tertiary" textAlign="center" px={4}>
                  {searchTerm || activeFilter !== "All" ? "No matching notes" : "No notes yet"}
                </Text>
                {!searchTerm && activeFilter === "All" && (
                  <Button size="xs" variant="ghost" color="primary" onClick={handleCreateNote}>
                    Create one
                  </Button>
                )}
              </VStack>
            ) : (
              filteredNotes.map((note) => {
                const isActive = note.id === activeNoteId;
                return (
                  <Box
                    key={note.id}
                    px={4}
                    py={3}
                    cursor="pointer"
                    bg={isActive ? "primary" : "transparent"}
                    _hover={{ bg: isActive ? "primary" : "bg.hover" }}
                    borderRadius="8px"
                    onClick={() => handleSelectNote(note.id)}
                    onContextMenu={(e) => handleContextMenu(e, note)}
                    transition="background 0.1s ease"
                    mx={2}
                  >
                    <Text fontSize="sm" fontWeight="600" color={isActive ? "white" : "text"} noOfLines={1} mb={0.5}>
                      {note.title || "Untitled"}
                    </Text>
                    <Text fontSize="xs" color={isActive ? "whiteAlpha.800" : "text.secondary"} noOfLines={1} mb={1}>
                      {stripHtml(note.content) || "No content"}
                    </Text>
                    <HStack spacing={2}>
                      {note.category && (
                        <Text fontSize="xs" color={isActive ? "whiteAlpha.700" : "text.tertiary"} fontWeight="500">
                          {note.category}
                        </Text>
                      )}
                      {note.category && (
                        <Text fontSize="xs" color={isActive ? "whiteAlpha.500" : "text.tertiary"}>
                          &middot;
                        </Text>
                      )}
                      <Text fontSize="xs" color={isActive ? "whiteAlpha.700" : "text.tertiary"}>
                        {formatDate(note.updatedAt)}
                      </Text>
                    </HStack>
                  </Box>
                );
              })
            )}
          </VStack>
        </Flex>
      )}

      {/* ========== EDITOR PANEL ========== */}
      {showEditor && (
        activeNote ? (
          <Flex direction="column" flex={1} h="100%" overflow="hidden" bg="background">
            {/* Top bar */}
            <Flex
              px={{ base: 5, lg: 10 }}
              pt={{ base: 4, lg: 5 }}
              pb={2}
              align="center"
              justify="space-between"
              flexShrink={0}
            >
              {!isDesktop && (
                <IconButton
                  icon={<FiArrowLeft />}
                  variant="ghost"
                  size="sm"
                  color="text.secondary"
                  _hover={{ bg: "bg.hover" }}
                  onClick={handleBackToList}
                  aria-label="Back to list"
                  mr={2}
                />
              )}
              <Box flex={1} />
              <IconButton
                icon={<FiTrash2 />}
                variant="ghost"
                size="sm"
                color="text.tertiary"
                _hover={{ bg: "bg.hover", color: "red.400" }}
                onClick={() => {
                  setNoteToDelete(activeNote);
                  onDeleteOpen();
                }}
                aria-label="Delete note"
              />
            </Flex>

            {/* Title */}
            <Box px={{ base: 5, lg: 10 }} pb={1} flexShrink={0}>
              <Input
                ref={titleRef}
                value={draftTitle}
                onChange={handleTitleChange}
                placeholder="Untitled"
                variant="unstyled"
                fontSize={{ base: "xl", md: "2xl" }}
                fontWeight="700"
                color="text"
                letterSpacing="-0.02em"
                _placeholder={{ color: "text.tertiary" }}
                py={1}
              />
            </Box>

            {/* Meta row */}
            <Flex
              px={{ base: 5, lg: 10 }}
              pb={3}
              align="center"
              gap={3}
              flexWrap="wrap"
              flexShrink={0}
            >
              {/* Category picker popover */}
              <Popover
                isOpen={isCatOpen}
                onOpen={() => { setCategorySearch(""); onCatOpen(); }}
                onClose={onCatClose}
                placement="bottom-start"
                isLazy
              >
                <PopoverTrigger>
                  <Button
                    size="xs"
                    variant="ghost"
                    bg="bg.surface"
                    border="1px solid"
                    borderColor="border"
                    color={activeNote.category ? "text.secondary" : "text.tertiary"}
                    borderRadius="full"
                    fontWeight="500"
                    fontSize="xs"
                    px={3}
                    _hover={{ bg: "bg.hover" }}
                  >
                    {activeNote.category || "Categorize"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  w="220px"
                  bg="background"
                  borderColor="border"
                  borderRadius="8px"
                  shadow="0 8px 24px rgba(0,0,0,0.15)"
                  _focus={{ outline: "none" }}
                >
                  <PopoverBody p={2}>
                    <Input
                      placeholder="Search or create..."
                      size="xs"
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      mb={2}
                      borderRadius="4px"
                      fontSize="xs"
                      autoFocus
                    />
                    <VStack align="stretch" spacing={0} maxH="200px" overflowY="auto">
                      {/* None option */}
                      <Flex
                        px={2}
                        py={1.5}
                        cursor="pointer"
                        borderRadius="4px"
                        _hover={{ bg: "bg.hover" }}
                        align="center"
                        justify="space-between"
                        onClick={() => assignCategory("")}
                      >
                        <Text fontSize="xs" color="text.tertiary" fontStyle="italic">None</Text>
                        {!activeNote.category && <Icon as={FiCheck} boxSize="12px" color="primary" />}
                      </Flex>

                      {filteredCategoryOptions.map((cat) => (
                        <Flex
                          key={cat}
                          px={2}
                          py={1.5}
                          cursor="pointer"
                          borderRadius="4px"
                          _hover={{ bg: "bg.hover" }}
                          align="center"
                          justify="space-between"
                          onClick={() => assignCategory(cat)}
                        >
                          <Text fontSize="xs" color="text" noOfLines={1}>{cat}</Text>
                          {activeNote.category === cat && <Icon as={FiCheck} boxSize="12px" color="primary" />}
                        </Flex>
                      ))}

                      {/* Create new option */}
                      {showCreateOption && (
                        <Flex
                          px={2}
                          py={1.5}
                          cursor="pointer"
                          borderRadius="4px"
                          _hover={{ bg: "bg.hover" }}
                          align="center"
                          onClick={() => assignCategory(categorySearchTrimmed)}
                        >
                          <Icon as={FiPlus} boxSize="10px" color="primary" mr={1.5} />
                          <Text fontSize="xs" color="primary">
                            Create &ldquo;{categorySearchTrimmed}&rdquo;
                          </Text>
                        </Flex>
                      )}
                    </VStack>
                  </PopoverBody>
                </PopoverContent>
              </Popover>

              {/* Link Event */}
              <Popover
                isOpen={isLinkEventOpen}
                onOpen={() => { setLinkEventSearch(""); onLinkEventOpen(); }}
                onClose={onLinkEventClose}
                placement="bottom-start"
                isLazy
              >
                <PopoverTrigger>
                  <Button
                    size="xs" variant="ghost" bg="bg.surface" border="1px solid" borderColor="border"
                    color="text.tertiary" borderRadius="full" fontWeight="500" fontSize="xs" px={2}
                    _hover={{ bg: "bg.hover" }} leftIcon={<Icon as={FiCalendar} boxSize="10px" />}
                  >
                    Link Event
                  </Button>
                </PopoverTrigger>
                <PopoverContent w="260px" bg="background" borderColor="border" borderRadius="8px" shadow="0 8px 24px rgba(0,0,0,0.15)" _focus={{ outline: "none" }}>
                  <PopoverBody p={2}>
                    <Input placeholder="Search events..." size="xs" value={linkEventSearch} onChange={(e) => setLinkEventSearch(e.target.value)} mb={2} borderRadius="4px" fontSize="xs" autoFocus />
                    <VStack align="stretch" spacing={0} maxH="200px" overflowY="auto">
                      {availableEvents.length === 0 && <Text fontSize="xs" color="text.tertiary" px={2} py={1.5} fontStyle="italic">No events found</Text>}
                      {availableEvents.map((evt) => {
                        const linked = (activeNote.linkedEventIds || []).includes(evt.id);
                        return (
                          <Flex key={evt.id} px={2} py={1.5} cursor="pointer" borderRadius="4px" _hover={{ bg: "bg.hover" }} align="center" justify="space-between" onClick={() => handleLinkEvent(evt.id)}>
                            <Text fontSize="xs" color="text" noOfLines={1} flex={1}>{evt.title || "Untitled"}</Text>
                            {linked && <Icon as={FiCheck} boxSize="12px" color="primary" ml={1} />}
                          </Flex>
                        );
                      })}
                    </VStack>
                  </PopoverBody>
                </PopoverContent>
              </Popover>

              {/* Link Todo */}
              <Popover
                isOpen={isLinkTodoOpen}
                onOpen={() => { setLinkTodoSearch(""); onLinkTodoOpen(); }}
                onClose={onLinkTodoClose}
                placement="bottom-start"
                isLazy
              >
                <PopoverTrigger>
                  <Button
                    size="xs" variant="ghost" bg="bg.surface" border="1px solid" borderColor="border"
                    color="text.tertiary" borderRadius="full" fontWeight="500" fontSize="xs" px={2}
                    _hover={{ bg: "bg.hover" }} leftIcon={<Icon as={FiCheckSquare} boxSize="10px" />}
                  >
                    Link Todo
                  </Button>
                </PopoverTrigger>
                <PopoverContent w="260px" bg="background" borderColor="border" borderRadius="8px" shadow="0 8px 24px rgba(0,0,0,0.15)" _focus={{ outline: "none" }}>
                  <PopoverBody p={2}>
                    <Input placeholder="Search todos..." size="xs" value={linkTodoSearch} onChange={(e) => setLinkTodoSearch(e.target.value)} mb={2} borderRadius="4px" fontSize="xs" autoFocus />
                    <VStack align="stretch" spacing={0} maxH="200px" overflowY="auto">
                      {availableTodos.length === 0 && <Text fontSize="xs" color="text.tertiary" px={2} py={1.5} fontStyle="italic">No todos found</Text>}
                      {availableTodos.map((todo) => {
                        const linked = (activeNote.linkedTodoIds || []).includes(todo.id);
                        return (
                          <Flex key={todo.id} px={2} py={1.5} cursor="pointer" borderRadius="4px" _hover={{ bg: "bg.hover" }} align="center" justify="space-between" onClick={() => handleLinkTodo(todo.id)}>
                            <Text fontSize="xs" color="text" noOfLines={1} flex={1}>{todo.title || "Untitled"}</Text>
                            {linked && <Icon as={FiCheck} boxSize="12px" color="primary" ml={1} />}
                          </Flex>
                        );
                      })}
                    </VStack>
                  </PopoverBody>
                </PopoverContent>
              </Popover>

              {/* Linked item badges */}
              {(activeNote.linkedEventIds || []).length > 0 && (
                <HStack spacing={1} flexWrap="wrap">
                  {(activeNote.linkedEventIds || []).map((eid) => {
                    const evt = cachedEvents.find((e) => e.id === eid);
                    return (
                      <Badge key={eid} variant="subtle" bg="blue.900" color="blue.200" fontSize="xs" borderRadius="full" px={2} py={0.5} fontWeight="500" display="flex" alignItems="center" gap={1}>
                        <Icon as={FiCalendar} boxSize="9px" />
                        {evt?.title || "Event"}
                      </Badge>
                    );
                  })}
                </HStack>
              )}
              {(activeNote.linkedTodoIds || []).length > 0 && (
                <HStack spacing={1} flexWrap="wrap">
                  {(activeNote.linkedTodoIds || []).map((tid) => {
                    const todo = cachedTodos.find((t) => t.id === tid);
                    return (
                      <Badge key={tid} variant="subtle" bg="teal.900" color="teal.200" fontSize="xs" borderRadius="full" px={2} py={0.5} fontWeight="500" display="flex" alignItems="center" gap={1}>
                        <Icon as={FiCheckSquare} boxSize="9px" />
                        {todo?.title || "Todo"}
                      </Badge>
                    );
                  })}
                </HStack>
              )}

              {activeNote.tags.length > 0 && (
                <HStack spacing={1} flexWrap="wrap">
                  {activeNote.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="subtle"
                      bg="bg.surface"
                      color="text.secondary"
                      fontSize="xs"
                      borderRadius="full"
                      px={2}
                      py={0.5}
                      fontWeight="500"
                      cursor="pointer"
                      _hover={{ bg: "bg.hover" }}
                      onClick={() => handleRemoveTag(tag)}
                      display="flex"
                      alignItems="center"
                      gap={1}
                    >
                      {tag}
                      <Icon as={FiX} boxSize="10px" />
                    </Badge>
                  ))}
                </HStack>
              )}

              <Text fontSize="xs" color="text.tertiary" ml="auto">
                {formatDate(activeNote.updatedAt)}
              </Text>
            </Flex>

            {/* Tags input */}
            <Box px={{ base: 5, lg: 10 }} pb={3} flexShrink={0}>
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onBlur={handleTagInputBlur}
                onKeyDown={handleTagInputKeyDown}
                placeholder="Add tags (comma-separated)..."
                variant="unstyled"
                fontSize="xs"
                color="text.tertiary"
                _placeholder={{ color: "text.tertiary" }}
              />
            </Box>

            {/* Formatting toolbar */}
            <HStack
              px={{ base: 5, lg: 10 }}
              py={2}
              spacing={1}
              flexShrink={0}
              borderTop="1px solid"
              borderBottom="1px solid"
              borderColor="border"
              bg="bg.surface"
            >
              <IconButton
                icon={<FiBold />}
                size="sm"
                variant="ghost"
                color={activeFormats.bold ? "text" : "text.secondary"}
                bg={activeFormats.bold ? "bg.hover" : "transparent"}
                _hover={{ bg: "bg.hover" }}
                onClick={() => handleFormat("bold")}
                aria-label="Bold"
                borderRadius="4px"
                minW="32px"
                h="32px"
              />
              <IconButton
                icon={<FiItalic />}
                size="sm"
                variant="ghost"
                color={activeFormats.italic ? "text" : "text.secondary"}
                bg={activeFormats.italic ? "bg.hover" : "transparent"}
                _hover={{ bg: "bg.hover" }}
                onClick={() => handleFormat("italic")}
                aria-label="Italic"
                borderRadius="4px"
                minW="32px"
                h="32px"
              />
              <IconButton
                icon={<FiUnderline />}
                size="sm"
                variant="ghost"
                color={activeFormats.underline ? "text" : "text.secondary"}
                bg={activeFormats.underline ? "bg.hover" : "transparent"}
                _hover={{ bg: "bg.hover" }}
                onClick={() => handleFormat("underline")}
                aria-label="Underline"
                borderRadius="4px"
                minW="32px"
                h="32px"
              />

              <Box w="1px" h="18px" bg="border" mx={2} />

              <IconButton
                size="sm"
                variant="ghost"
                color="text.secondary"
                bg={isHighlightActive() ? "bg.hover" : "transparent"}
                _hover={{ bg: "bg.hover" }}
                onClick={handleHighlightToggle}
                aria-label="Highlight"
                borderRadius="4px"
                minW="32px"
                h="32px"
              >
                <Box
                  w="16px"
                  h="16px"
                  borderRadius="3px"
                  bg="#B8C9A3"
                  border="1.5px solid"
                  borderColor="#9AB087"
                />
              </IconButton>

              <Box w="1px" h="18px" bg="border" mx={2} />

              <IconButton
                icon={<FiAlignLeft />}
                size="sm"
                variant="ghost"
                color={activeFormats.justifyLeft ? "text" : "text.secondary"}
                bg={activeFormats.justifyLeft ? "bg.hover" : "transparent"}
                _hover={{ bg: "bg.hover" }}
                onClick={() => handleFormat("justifyLeft")}
                aria-label="Align left"
                borderRadius="4px"
                minW="32px"
                h="32px"
              />
              <IconButton
                icon={<FiAlignCenter />}
                size="sm"
                variant="ghost"
                color={activeFormats.justifyCenter ? "text" : "text.secondary"}
                bg={activeFormats.justifyCenter ? "bg.hover" : "transparent"}
                _hover={{ bg: "bg.hover" }}
                onClick={() => handleFormat("justifyCenter")}
                aria-label="Align center"
                borderRadius="4px"
                minW="32px"
                h="32px"
              />
              <IconButton
                icon={<FiAlignRight />}
                size="sm"
                variant="ghost"
                color={activeFormats.justifyRight ? "text" : "text.secondary"}
                bg={activeFormats.justifyRight ? "bg.hover" : "transparent"}
                _hover={{ bg: "bg.hover" }}
                onClick={() => handleFormat("justifyRight")}
                aria-label="Align right"
                borderRadius="4px"
                minW="32px"
                h="32px"
              />

              <Box w="1px" h="18px" bg="border" mx={2} />

              <IconButton
                icon={<FiList />}
                size="sm"
                variant="ghost"
                color={activeFormats.insertUnorderedList ? "text" : "text.secondary"}
                bg={activeFormats.insertUnorderedList ? "bg.hover" : "transparent"}
                _hover={{ bg: "bg.hover" }}
                onClick={() => handleFormat("insertUnorderedList")}
                aria-label="Bullet list"
                borderRadius="4px"
                minW="32px"
                h="32px"
              />
            </HStack>

            {/* Content editor */}
            <Box flex={1} overflow="auto" position="relative">
              {isContentEmpty && (
                <Text
                  position="absolute"
                  top={4}
                  left={{ base: 5, lg: 10 }}
                  color="text.tertiary"
                  fontStyle="italic"
                  fontSize="md"
                  pointerEvents="none"
                  userSelect="none"
                >
                  Start writing...
                </Text>
              )}
              <Box
                ref={editorRef}
                contentEditable
                onInput={handleContentInput}
                className="note-editor-content"
                px={{ base: 5, lg: 10 }}
                py={4}
                minH="100%"
                fontSize="md"
                color="text"
                lineHeight="1.75"
                outline="none"
                sx={{
                  "& ul, & ol": { pl: "1.5em", my: "0.5em" },
                  "& li": { my: "0.25em" },
                }}
              />
            </Box>
          </Flex>
        ) : (
          /* Empty state */
          <Flex flex={1} align="center" justify="center" direction="column" bg="background">
            <Icon as={FiFileText} boxSize={12} color="text.tertiary" mb={4} />
            <Text color="text.secondary" fontSize="md" mb={1}>
              Select a note or create a new one
            </Text>
            <Button
              size="sm"
              variant="ghost"
              color="primary"
              leftIcon={<FiPlus />}
              onClick={handleCreateNote}
              mt={2}
            >
              New Note
            </Button>
          </Flex>
        )
      )}

      {/* ========== CONTEXT MENU ========== */}
      {contextMenu && (
        <Box
          position="fixed"
          top={`${contextMenu.y}px`}
          left={`${contextMenu.x}px`}
          bg="background"
          border="1px solid"
          borderColor="border"
          borderRadius="8px"
          shadow="0 8px 24px rgba(0,0,0,0.18)"
          py={1}
          zIndex={9999}
          minW="140px"
        >
          <Box
            px={3}
            py={1.5}
            cursor="pointer"
            _hover={{ bg: "bg.hover" }}
            onClick={() => {
              handleSelectNote(contextMenu.item.id);
              setContextMenu(null);
            }}
          >
            <Text fontSize="sm" color="text">Open</Text>
          </Box>
          <Box
            px={3}
            py={1.5}
            cursor="pointer"
            _hover={{ bg: "bg.hover" }}
            onClick={() => {
              setNoteToDelete(contextMenu.item);
              onDeleteOpen();
              setContextMenu(null);
            }}
          >
            <Text fontSize="sm" color="red.400">Delete</Text>
          </Box>
        </Box>
      )}

      {/* ========== DELETE DIALOG ========== */}
      <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelRef} onClose={onDeleteClose}>
        <AlertDialogOverlay>
          <AlertDialogContent borderRadius="12px">
            <AlertDialogHeader fontSize="lg" fontWeight="600" color="text">
              Delete Note
            </AlertDialogHeader>
            <AlertDialogBody color="text.secondary">
              Are you sure you want to delete &ldquo;{noteToDelete?.title || "Untitled"}&rdquo;? This
              action cannot be undone.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose} variant="ghost">
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleDeleteConfirm} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Flex>
  );
};

export default NotesPage;
