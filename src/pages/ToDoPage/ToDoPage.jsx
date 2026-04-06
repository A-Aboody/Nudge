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
  Textarea,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  ModalCloseButton,
  Select,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  useDisclosure,
  useColorModeValue,
} from "@chakra-ui/react";
import {
  FiPlus,
  FiSearch,
  FiCalendar,
  FiTag,
  FiTrash2,
  FiCheck,
  FiRepeat,
  FiChevronDown,
  FiChevronUp,
  FiX,
  FiCheckSquare,
  FiAlignLeft,
} from "react-icons/fi";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Reorder } from "framer-motion";
import { createEventFromTodo } from "../../utils/linkHelpers";
import { useAuth } from "../../context/AuthContext";
import { loadTodos as dbLoadTodos, saveTodos as dbSaveTodos, loadCategories as dbLoadCategories, saveCategories as dbSaveCategories } from "../../services/db";
import { updateAppBadge } from "../../services/notifications";

// --- Constants ---

const RECURRING_OPTIONS = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

// --- Helpers ---

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatFullDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// --- Main Component ---

const ToDoPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Core data
  const [todos, setTodos] = useState([]);
  const [storedCategories, setStoredCategories] = useState([]);
  const initialLoadDone = useRef(false);

  // UI state
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [completedCollapsed, setCompletedCollapsed] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);

  // Detail view state
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [hideCheckedItems, setHideCheckedItems] = useState(false);

  // Context menu
  const [contextMenu, setContextMenu] = useState(null);

  // Popover state
  const [categorySearch, setCategorySearch] = useState("");
  const [filterSearch, setFilterSearch] = useState("");

  // Disclosures
  const { isOpen: isDetailOpen, onOpen: onDetailOpen, onClose: onDetailClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const { isOpen: isCatOpen, onOpen: onCatOpen, onClose: onCatClose } = useDisclosure();
  const { isOpen: isFilterOpen, onOpen: onFilterOpen, onClose: onFilterClose } = useDisclosure();

  // URL params (for deep-linking from dashboard)
  const [searchParams, setSearchParams] = useSearchParams();

  // Refs
  const cancelRef = useRef();
  const titleRef = useRef();
  const storageSaveTimer = useRef(null);
  const isDragging = useRef(false);

  // Drag shadow
  const dragShadow = useColorModeValue(
    "0 8px 24px rgba(0,0,0,0.08)",
    "0 8px 24px rgba(0,0,0,0.3)"
  );

  // --- Derived state ---

  const activeTask = todos.find((t) => t.id === activeTaskId) || null;

  const allCategories = useMemo(() => {
    const cats = new Set(storedCategories);
    todos.forEach((t) => {
      if (t.category && t.category.trim()) cats.add(t.category.trim());
    });
    return Array.from(cats).sort();
  }, [todos, storedCategories]);

  const filteredTodos = useMemo(() => {
    return todos.filter((t) => {
      const matchesSearch =
        !searchTerm ||
        t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()));
      if (!matchesSearch) return false;
      if (activeFilter === "All") return true;
      return t.category === activeFilter;
    });
  }, [todos, searchTerm, activeFilter]);

  const activeTasks = useMemo(() => filteredTodos.filter((t) => !t.completed), [filteredTodos]);
  const completedTasks = useMemo(
    () =>
      filteredTodos
        .filter((t) => t.completed)
        .sort((a, b) => new Date(b.completedAt || b.updatedAt) - new Date(a.completedAt || a.updatedAt)),
    [filteredTodos]
  );

  // Category popover derived
  const filteredCategoryOptions = useMemo(() => {
    const term = categorySearch.trim().toLowerCase();
    return term ? allCategories.filter((c) => c.toLowerCase().includes(term)) : allCategories;
  }, [allCategories, categorySearch]);

  const categorySearchTrimmed = categorySearch.trim();
  const showCreateOption =
    categorySearchTrimmed &&
    !allCategories.some((c) => c.toLowerCase() === categorySearchTrimmed.toLowerCase());

  // Filter dropdown derived
  const filteredFilterOptions = useMemo(() => {
    const term = filterSearch.trim().toLowerCase();
    return term ? allCategories.filter((c) => c.toLowerCase().includes(term)) : allCategories;
  }, [allCategories, filterSearch]);

  // Checklist derived
  const checklist = activeTask?.checklist || [];
  const visibleChecklist = hideCheckedItems ? checklist.filter((i) => !i.checked) : checklist;
  const checkedCount = checklist.filter((i) => i.checked).length;
  const checklistProgress = checklist.length > 0 ? Math.round((checkedCount / checklist.length) * 100) : 0;

  // --- Effects ---

  // Load from Firestore on mount
  useEffect(() => {
    if (!user) return;
    Promise.all([dbLoadTodos(user.uid), dbLoadCategories(user.uid, "todo")]).then(([t, c]) => {
      setTodos(t);
      setStoredCategories(c);
      initialLoadDone.current = true;
    });
  }, [user]);

  // Persist todos (debounced)
  useEffect(() => {
    if (!user || !initialLoadDone.current) return;
    if (storageSaveTimer.current) clearTimeout(storageSaveTimer.current);
    storageSaveTimer.current = setTimeout(() => {
      dbSaveTodos(user.uid, todos);
      updateAppBadge(todos.filter((t) => !t.completed).length);
    }, 500);
    return () => {
      if (storageSaveTimer.current) clearTimeout(storageSaveTimer.current);
    };
  }, [todos, user]);

  // Persist categories
  useEffect(() => {
    if (!user || !initialLoadDone.current) return;
    dbSaveCategories(user.uid, "todo", storedCategories);
  }, [storedCategories, user]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (storageSaveTimer.current) clearTimeout(storageSaveTimer.current);
    };
  }, []);

  // Sync detail view drafts when active task changes
  useEffect(() => {
    if (activeTask) {
      setDraftTitle(activeTask.title);
      setDraftDescription(activeTask.description || "");
      setNewChecklistItem("");
      setHideCheckedItems(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTaskId]);

  // Close detail if active task was deleted externally
  useEffect(() => {
    if (activeTaskId && !todos.find((t) => t.id === activeTaskId)) {
      setActiveTaskId(null);
      onDetailClose();
    }
  }, [todos, activeTaskId, onDetailClose]);

  // Handle ?id= deep-link on mount
  useEffect(() => {
    const idParam = searchParams.get("id");
    if (idParam) {
      const numId = Number(idParam);
      const task = todos.find((t) => t.id === numId);
      if (task) {
        setActiveTaskId(numId);
        onDetailOpen();
      }
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close context menu on click/scroll/escape
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

  // --- Handlers ---

  const updateActiveTask = useCallback(
    (updates) => {
      if (!activeTaskId) return;
      setTodos((prev) =>
        prev.map((t) =>
          t.id === activeTaskId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
        )
      );
    },
    [activeTaskId]
  );

  const handleOpenDetail = (task) => {
    setActiveTaskId(task.id);
    onDetailOpen();
  };

  const handleCloseDetail = () => {
    // Remove empty tasks (no title, no description, no checklist)
    if (activeTaskId) {
      const task = todos.find((t) => t.id === activeTaskId);
      if (
        task &&
        !task.title.trim() &&
        !task.description.trim() &&
        (!task.checklist || task.checklist.length === 0)
      ) {
        setTodos((prev) => prev.filter((t) => t.id !== activeTaskId));
      }
    }
    setActiveTaskId(null);
    onDetailClose();
  };

  const handleAddTask = () => {
    const now = new Date().toISOString();
    const newTask = {
      id: Date.now(),
      title: "",
      description: "",
      dueDate: "",
      category: "",
      recurring: "none",
      completed: false,
      completedAt: "",
      linkedNoteId: null,
      linkedEventId: null,
      checklist: [],
      createdAt: now,
      updatedAt: now,
    };
    setTodos((prev) => [newTask, ...prev]);
    setActiveTaskId(newTask.id);
    onDetailOpen();
    setTimeout(() => titleRef.current?.focus(), 100);
  };

  const handleToggleComplete = useCallback(
    (taskId) => {
      const now = new Date().toISOString();
      setTodos((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                completed: !t.completed,
                completedAt: !t.completed ? now : "",
                updatedAt: now,
              }
            : t
        )
      );
    },
    []
  );

  const handleRequestDelete = (task) => {
    setTaskToDelete(task);
    onDeleteOpen();
  };

  const handleDeleteConfirm = () => {
    if (!taskToDelete) return;
    const deletedId = taskToDelete.id;
    setTodos((prev) => prev.filter((t) => t.id !== deletedId));
    setTaskToDelete(null);
    onDeleteClose();
    if (deletedId === activeTaskId) {
      setActiveTaskId(null);
      onDetailClose();
    }
  };

  const handleClearCompleted = () => {
    setTodos((prev) => prev.filter((t) => !t.completed));
  };

  const handleReorder = useCallback((newVisibleOrder) => {
    setTodos((prev) => {
      const visibleIds = new Set(newVisibleOrder.map((t) => t.id));
      const result = [];
      let visibleIndex = 0;
      for (const t of prev) {
        if (visibleIds.has(t.id)) {
          result.push(newVisibleOrder[visibleIndex++]);
        } else {
          result.push(t);
        }
      }
      return result;
    });
  }, []);

  // Detail view field handlers
  const handleDetailTitleChange = (e) => {
    const value = e.target.value;
    setDraftTitle(value);
    updateActiveTask({ title: value });
  };

  const handleDetailDescriptionChange = (e) => {
    const value = e.target.value;
    setDraftDescription(value);
    updateActiveTask({ description: value });
  };

  // Checklist handlers
  const addChecklistItem = () => {
    const text = newChecklistItem.trim();
    if (!text || !activeTaskId) return;
    const item = { id: Date.now(), text, checked: false };
    updateActiveTask({ checklist: [...checklist, item] });
    setNewChecklistItem("");
  };

  const toggleChecklistItem = (itemId) => {
    const updated = checklist.map((i) => (i.id === itemId ? { ...i, checked: !i.checked } : i));
    updateActiveTask({ checklist: updated });
  };

  const deleteChecklistItem = (itemId) => {
    updateActiveTask({ checklist: checklist.filter((i) => i.id !== itemId) });
  };

  const clearChecklist = () => {
    updateActiveTask({ checklist: [] });
  };

  // Category handlers
  const assignCategory = (cat) => {
    if (cat && !storedCategories.includes(cat)) {
      setStoredCategories((prev) => [...prev, cat]);
    }
    updateActiveTask({ category: cat });
    setCategorySearch("");
    onCatClose();
  };

  const deleteCategory = (cat) => {
    setStoredCategories((prev) => prev.filter((c) => c !== cat));
    setTodos((prev) => prev.map((t) => (t.category === cat ? { ...t, category: "" } : t)));
    if (activeFilter === cat) setActiveFilter("All");
  };

  const handleFilterSelect = (key) => {
    setActiveFilter(key);
    setFilterSearch("");
    onFilterClose();
  };

  const handleContextMenu = useCallback((e, task) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, item: task });
  }, []);

  // --- Render ---

  return (
    <Box px={{ base: 5, md: 10 }} py={{ base: 6, md: 8 }} minH="100vh">
      {/* Header */}
      <Flex align="center" justify="space-between" mb={8}>
        <Text
          fontSize={{ base: "lg", md: "xl" }}
          fontWeight="700"
          color="text"
          letterSpacing="-0.02em"
        >
          Tasks
        </Text>
        <Button
          leftIcon={<FiPlus />}
          onClick={handleAddTask}
          bg="primary"
          color="white"
          _hover={{ bg: "#5a6656" }}
          size="sm"
          fontWeight="500"
          borderRadius="6px"
        >
          New Task
        </Button>
      </Flex>

      {/* Search + Filter row */}
      <Flex gap={3} mb={6} align="center">
        <InputGroup size="sm" flex={1}>
          <InputLeftElement pointerEvents="none">
            <Icon as={FiSearch} color="text.tertiary" boxSize="14px" />
          </InputLeftElement>
          <Input
            placeholder="Search tasks..."
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

        {/* Filter dropdown */}
        <Popover
          isOpen={isFilterOpen}
          onOpen={() => { setFilterSearch(""); onFilterOpen(); }}
          onClose={onFilterClose}
          placement="bottom-end"
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
              flexShrink={0}
              _hover={{ bg: "bg.hover" }}
              rightIcon={<Icon as={FiChevronDown} boxSize="12px" />}
            >
              {activeFilter === "All" ? "All Tasks" : activeFilter}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            w="240px"
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
                <Flex
                  px={2} py={1.5} cursor="pointer" borderRadius="4px"
                  _hover={{ bg: "bg.hover" }} align="center" justify="space-between"
                  onClick={() => handleFilterSelect("All")}
                >
                  <Text fontSize="xs" color="text" fontWeight={activeFilter === "All" ? "600" : "400"}>
                    All Tasks
                  </Text>
                  {activeFilter === "All" && <Icon as={FiCheck} boxSize="12px" color="primary" />}
                </Flex>
                {filteredFilterOptions.length > 0 && <Box h="1px" bg="border" my={1.5} mx={1} />}
                {filteredFilterOptions.map((cat) => (
                  <Flex
                    key={cat} px={2} py={1.5} cursor="pointer" borderRadius="4px"
                    _hover={{ bg: "bg.hover" }} align="center" justify="space-between"
                    onClick={() => handleFilterSelect(cat)}
                  >
                    <Text fontSize="xs" color="text" fontWeight={activeFilter === cat ? "600" : "400"} noOfLines={1} flex={1}>
                      {cat}
                    </Text>
                    <HStack spacing={1}>
                      {activeFilter === cat && <Icon as={FiCheck} boxSize="12px" color="primary" />}
                      <IconButton
                        icon={<FiX />} size="xs" variant="ghost"
                        color="text.tertiary" _hover={{ color: "red.400", bg: "transparent" }}
                        aria-label={`Delete ${cat}`} minW="18px" h="18px"
                        onClick={(e) => { e.stopPropagation(); deleteCategory(cat); }}
                      />
                    </HStack>
                  </Flex>
                ))}
                {allCategories.length === 0 && (
                  <Text fontSize="xs" color="text.tertiary" px={2} py={1.5} fontStyle="italic">
                    No categories yet
                  </Text>
                )}
              </VStack>
            </PopoverBody>
          </PopoverContent>
        </Popover>
      </Flex>

      {/* ========== ACTIVE TASKS ========== */}
      <Text
        fontSize="xs" fontWeight="600" color="text.secondary"
        letterSpacing="0.08em" textTransform="uppercase" mb={3}
      >
        To Do ({activeTasks.length})
      </Text>

      {activeTasks.length > 0 ? (
        <Reorder.Group
          axis="y"
          values={activeTasks}
          onReorder={handleReorder}
          as="div"
          style={{ listStyle: "none" }}
        >
          <VStack spacing={2} w="full" align="stretch" mb={2}>
            {activeTasks.map((task) => (
              <Reorder.Item
                key={task.id}
                value={task}
                as="div"
                style={{ borderRadius: "8px" }}
                whileDrag={{ scale: 1.02, boxShadow: dragShadow, zIndex: 10 }}
                transition={{ duration: 0.2 }}
                onDragStart={() => { isDragging.current = true; }}
                onDragEnd={() => { setTimeout(() => { isDragging.current = false; }, 0); }}
              >
                <Flex
                  className="task-item"
                  w="full"
                  p={{ base: 3, md: 4 }}
                  border="1px solid"
                  borderColor="border"
                  borderRadius="8px"
                  _hover={{ bg: "bg.hover" }}
                  transition="background 0.12s ease"
                  align="flex-start"
                  gap={{ base: 2, md: 3 }}
                  cursor="pointer"
                  onClick={() => { if (!isDragging.current) handleOpenDetail(task); }}
                  onContextMenu={(e) => handleContextMenu(e, task)}
                >
                  {/* Drag handle */}
                  <Flex
                    className="task-drag-handle"
                    direction="column"
                    gap="2px"
                    align="center"
                    justify="center"
                    py={1}
                    flexShrink={0}
                    aria-label="Drag to reorder"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {[0, 1, 2].map((i) => (
                      <Flex key={i} gap="3px">
                        <Box w="3px" h="3px" borderRadius="full" bg="text.tertiary" />
                        <Box w="3px" h="3px" borderRadius="full" bg="text.tertiary" />
                      </Flex>
                    ))}
                  </Flex>

                  {/* Checkbox */}
                  <Box
                    as="button"
                    flexShrink={0}
                    mt="2px"
                    w="18px"
                    h="18px"
                    borderRadius="4px"
                    border="2px solid"
                    borderColor="text.tertiary"
                    _hover={{ borderColor: "primary" }}
                    transition="all 0.15s ease"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleComplete(task.id);
                    }}
                  />

                  {/* Content */}
                  <Box flex={1} minW={0}>
                    <Flex justify="space-between" align="flex-start" gap={2}>
                      <Text fontSize="sm" fontWeight="500" color="text" noOfLines={1}>
                        {task.title || "Untitled"}
                      </Text>
                      {task.dueDate && (
                        <Text fontSize="xs" color="text.tertiary" flexShrink={0} whiteSpace="nowrap">
                          {formatDate(task.dueDate)}
                        </Text>
                      )}
                    </Flex>
                    {(task.category || (task.recurring && task.recurring !== "none")) && (
                      <HStack spacing={2} mt={0.5} flexWrap="wrap">
                        {task.category && (
                          <Text fontSize="xs" color="text.tertiary" fontWeight="500">
                            {task.category}
                          </Text>
                        )}
                        {task.recurring && task.recurring !== "none" && (
                          <HStack spacing={0.5}>
                            <Icon as={FiRepeat} boxSize="10px" color="text.tertiary" />
                            <Text fontSize="xs" color="text.tertiary">
                              {RECURRING_OPTIONS.find((o) => o.value === task.recurring)?.label}
                            </Text>
                          </HStack>
                        )}
                      </HStack>
                    )}
                    {task.description && (
                      <Text fontSize="xs" color="text.tertiary" noOfLines={1} mt={0.5}>
                        {task.description}
                      </Text>
                    )}
                    {/* Checklist progress indicator */}
                    {(task.checklist || []).length > 0 && (
                      <HStack spacing={1.5} mt={1}>
                        <Icon as={FiCheckSquare} boxSize="11px" color="text.tertiary" />
                        <Text fontSize="xs" color="text.tertiary">
                          {(task.checklist || []).filter((i) => i.checked).length}/{(task.checklist || []).length}
                        </Text>
                      </HStack>
                    )}
                  </Box>
                </Flex>
              </Reorder.Item>
            ))}
          </VStack>
        </Reorder.Group>
      ) : (
        <Box w="full" py={8} border="1px dashed" borderColor="border" borderRadius="8px" textAlign="center" mb={2}>
          <Text color="text.tertiary" fontSize="sm">
            {searchTerm || activeFilter !== "All" ? "No matching tasks" : "No tasks yet"}
          </Text>
          {!searchTerm && activeFilter === "All" && (
            <Button size="xs" variant="ghost" color="primary" mt={2} onClick={handleAddTask}>
              Add one to get started
            </Button>
          )}
        </Box>
      )}

      {/* ========== COMPLETED TASKS ========== */}
      <Flex align="center" justify="space-between" mt={8} mb={3}>
        <HStack spacing={2} cursor="pointer" onClick={() => setCompletedCollapsed((v) => !v)} userSelect="none">
          <Text fontSize="xs" fontWeight="600" color="text.secondary" letterSpacing="0.08em" textTransform="uppercase">
            Completed ({completedTasks.length})
          </Text>
          <Icon as={completedCollapsed ? FiChevronDown : FiChevronUp} boxSize="14px" color="text.tertiary" />
        </HStack>
        {completedTasks.length > 0 && (
          <Button size="xs" variant="ghost" color="text.tertiary" fontSize="xs" fontWeight="400" _hover={{ color: "text" }} onClick={handleClearCompleted}>
            Clear all
          </Button>
        )}
      </Flex>

      {!completedCollapsed && completedTasks.length > 0 && (
        <VStack spacing={1} w="full" align="stretch">
          {completedTasks.map((task) => (
            <Flex
              key={task.id}
              w="full"
              py={2.5}
              px={{ base: 3, md: 4 }}
              border="1px solid"
              borderColor="border"
              borderRadius="8px"
              bg="bg.surface"
              align="center"
              gap={{ base: 2, md: 3 }}
              _hover={{ bg: "bg.hover" }}
              transition="background 0.12s ease"
              cursor="pointer"
              onClick={() => handleOpenDetail(task)}
              onContextMenu={(e) => handleContextMenu(e, task)}
            >
              {/* Filled checkbox */}
              <Box
                as="button"
                flexShrink={0}
                w="18px"
                h="18px"
                borderRadius="4px"
                bg="primary"
                display="flex"
                alignItems="center"
                justifyContent="center"
                _hover={{ opacity: 0.8 }}
                transition="opacity 0.15s ease"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleComplete(task.id);
                }}
              >
                <Icon as={FiCheck} boxSize="12px" color="white" />
              </Box>
              <Text fontSize="sm" color="text.tertiary" textDecoration="line-through" flex={1} noOfLines={1}>
                {task.title || "Untitled"}
              </Text>
              {task.completedAt && (
                <Text fontSize="xs" color="text.tertiary" flexShrink={0} whiteSpace="nowrap">
                  {formatDate(task.completedAt)}
                </Text>
              )}
            </Flex>
          ))}
        </VStack>
      )}

      {!completedCollapsed && completedTasks.length === 0 && (
        <Box w="full" py={6} border="1px dashed" borderColor="border" borderRadius="8px" textAlign="center">
          <Text color="text.tertiary" fontSize="sm">
            {searchTerm || activeFilter !== "All" ? "No matching completed tasks" : "No tasks completed yet"}
          </Text>
        </Box>
      )}

      {/* ========== TASK DETAIL MODAL ========== */}
      <Modal isOpen={isDetailOpen} onClose={handleCloseDetail} size="xl" scrollBehavior="inside">
        <ModalOverlay bg="blackAlpha.600" />
        <ModalContent
          borderRadius={{ base: "0", md: "12px" }}
          mx={{ base: 0, md: 4 }}
          maxH={{ base: "100%", md: "85vh" }}
          minH={{ base: "100%", md: "auto" }}
          my={{ base: 0, md: "60px" }}
          bg="background"
          pt={{ base: "env(safe-area-inset-top)", md: 0 }}
        >
          <ModalCloseButton color="text.tertiary" zIndex={2} top={{ base: "calc(env(safe-area-inset-top) + 8px)", md: "8px" }} />
          <ModalBody pt={6} pb={8} px={{ base: 5, md: 8 }}>
            {activeTask && (
              <>
                {/* Status toggle */}
                <Box mb={5}>
                  <Button
                    size="sm"
                    borderRadius="6px"
                    fontWeight="500"
                    fontSize="xs"
                    px={3}
                    bg={activeTask.completed ? "primary" : "transparent"}
                    color={activeTask.completed ? "white" : "text.secondary"}
                    border="1px solid"
                    borderColor={activeTask.completed ? "primary" : "border"}
                    _hover={{
                      bg: activeTask.completed ? "#5a6656" : "bg.hover",
                    }}
                    leftIcon={<Icon as={FiCheck} boxSize="12px" />}
                    onClick={() => handleToggleComplete(activeTask.id)}
                  >
                    {activeTask.completed ? "Completed" : "Mark complete"}
                  </Button>
                </Box>

                {/* Title */}
                <HStack align="flex-start" spacing={3} mb={5}>
                  <Box
                    as="button"
                    mt="6px"
                    w="22px"
                    h="22px"
                    borderRadius="full"
                    border="2px solid"
                    borderColor={activeTask.completed ? "primary" : "text.tertiary"}
                    bg={activeTask.completed ? "primary" : "transparent"}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    onClick={() => handleToggleComplete(activeTask.id)}
                    _hover={{ borderColor: "primary" }}
                    transition="all 0.15s ease"
                    flexShrink={0}
                  >
                    {activeTask.completed && <Icon as={FiCheck} boxSize="14px" color="white" />}
                  </Box>
                  <Input
                    ref={titleRef}
                    value={draftTitle}
                    onChange={handleDetailTitleChange}
                    placeholder="Untitled task"
                    variant="unstyled"
                    fontSize={{ base: "xl", md: "2xl" }}
                    fontWeight="700"
                    color="text"
                    letterSpacing="-0.02em"
                    _placeholder={{ color: "text.tertiary" }}
                    py={0}
                  />
                </HStack>

                {/* Properties */}
                <VStack align="stretch" spacing={3} mb={5}>
                  {/* Category */}
                  <Flex align="center" gap={3}>
                    <HStack spacing={1.5} w="90px" flexShrink={0}>
                      <Icon as={FiTag} boxSize="13px" color="text.tertiary" />
                      <Text fontSize="xs" color="text.tertiary" fontWeight="500">
                        Category
                      </Text>
                    </HStack>
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
                          color={activeTask.category ? "text.secondary" : "text.tertiary"}
                          borderRadius="4px"
                          fontWeight="500"
                          fontSize="xs"
                          px={2}
                          h="28px"
                          _hover={{ bg: "bg.hover" }}
                        >
                          {activeTask.category || "None"}
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
                            <Flex
                              px={2} py={1.5} cursor="pointer" borderRadius="4px"
                              _hover={{ bg: "bg.hover" }} align="center" justify="space-between"
                              onClick={() => assignCategory("")}
                            >
                              <Text fontSize="xs" color="text.tertiary" fontStyle="italic">None</Text>
                              {!activeTask.category && <Icon as={FiCheck} boxSize="12px" color="primary" />}
                            </Flex>
                            {filteredCategoryOptions.map((cat) => (
                              <Flex
                                key={cat} px={2} py={1.5} cursor="pointer" borderRadius="4px"
                                _hover={{ bg: "bg.hover" }} align="center" justify="space-between"
                                onClick={() => assignCategory(cat)}
                              >
                                <Text fontSize="xs" color="text" noOfLines={1}>{cat}</Text>
                                {activeTask.category === cat && <Icon as={FiCheck} boxSize="12px" color="primary" />}
                              </Flex>
                            ))}
                            {showCreateOption && (
                              <Flex
                                px={2} py={1.5} cursor="pointer" borderRadius="4px"
                                _hover={{ bg: "bg.hover" }} align="center"
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
                  </Flex>

                  {/* Due Date */}
                  <Flex align="center" gap={3}>
                    <HStack spacing={1.5} w="90px" flexShrink={0}>
                      <Icon as={FiCalendar} boxSize="13px" color="text.tertiary" />
                      <Text fontSize="xs" color="text.tertiary" fontWeight="500">
                        Due Date
                      </Text>
                    </HStack>
                    <Input
                      type="date"
                      value={activeTask.dueDate}
                      onChange={(e) => updateActiveTask({ dueDate: e.target.value })}
                      size="xs"
                      variant="flushed"
                      fontSize="xs"
                      color="text.secondary"
                      w="auto"
                      minW="130px"
                      borderColor="border"
                      _focus={{ borderColor: "primary" }}
                    />
                    {activeTask.dueDate && (
                      <IconButton
                        icon={<FiX />}
                        size="xs"
                        variant="ghost"
                        color="text.tertiary"
                        _hover={{ color: "text" }}
                        aria-label="Clear date"
                        minW="20px"
                        h="20px"
                        onClick={() => updateActiveTask({ dueDate: "" })}
                      />
                    )}
                  </Flex>

                  {/* Recurring */}
                  <Flex align="center" gap={3}>
                    <HStack spacing={1.5} w="90px" flexShrink={0}>
                      <Icon as={FiRepeat} boxSize="13px" color="text.tertiary" />
                      <Text fontSize="xs" color="text.tertiary" fontWeight="500">
                        Recurring
                      </Text>
                    </HStack>
                    <Select
                      value={activeTask.recurring || "none"}
                      onChange={(e) => updateActiveTask({ recurring: e.target.value })}
                      size="xs"
                      variant="flushed"
                      fontSize="xs"
                      color="text.secondary"
                      w="auto"
                      minW="130px"
                      borderColor="border"
                      _focus={{ borderColor: "primary" }}
                    >
                      {RECURRING_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  </Flex>
                </VStack>

                {/* Divider */}
                <Box h="1px" bg="border" my={5} />

                {/* Description */}
                <Box mb={5}>
                  <HStack spacing={2} mb={3}>
                    <Icon as={FiAlignLeft} boxSize="14px" color="text.secondary" />
                    <Text fontSize="sm" fontWeight="600" color="text.secondary">
                      Description
                    </Text>
                  </HStack>
                  <Textarea
                    value={draftDescription}
                    onChange={handleDetailDescriptionChange}
                    placeholder="Add a more detailed description..."
                    fontSize="sm"
                    color="text"
                    bg="bg.surface"
                    border="1px solid"
                    borderColor="border"
                    borderRadius="8px"
                    _placeholder={{ color: "text.tertiary" }}
                    _focus={{ borderColor: "primary", bg: "background" }}
                    rows={4}
                    resize="vertical"
                    lineHeight="1.6"
                  />
                </Box>

                {/* Divider */}
                <Box h="1px" bg="border" my={5} />

                {/* Checklist */}
                <Box>
                  <Flex align="center" justify="space-between" mb={3}>
                    <HStack spacing={2}>
                      <Icon as={FiCheckSquare} boxSize="14px" color="text.secondary" />
                      <Text fontSize="sm" fontWeight="600" color="text.secondary">
                        Checklist
                      </Text>
                    </HStack>
                    <HStack spacing={2}>
                      {checklist.some((i) => i.checked) && (
                        <Button
                          size="xs"
                          variant="ghost"
                          color="text.tertiary"
                          fontSize="xs"
                          fontWeight="400"
                          _hover={{ color: "text" }}
                          onClick={() => setHideCheckedItems((v) => !v)}
                        >
                          {hideCheckedItems ? "Show checked" : "Hide checked"}
                        </Button>
                      )}
                      {checklist.length > 0 && (
                        <Button
                          size="xs"
                          variant="ghost"
                          color="text.tertiary"
                          fontSize="xs"
                          fontWeight="400"
                          _hover={{ color: "red.400" }}
                          onClick={clearChecklist}
                        >
                          Delete
                        </Button>
                      )}
                    </HStack>
                  </Flex>

                  {/* Progress bar */}
                  {checklist.length > 0 && (
                    <Flex align="center" gap={2} mb={3}>
                      <Text fontSize="xs" color="text.tertiary" w="30px" textAlign="right" flexShrink={0}>
                        {checklistProgress}%
                      </Text>
                      <Box flex={1} h="6px" bg="bg.surface" borderRadius="3px" overflow="hidden">
                        <Box
                          h="full"
                          w={`${checklistProgress}%`}
                          bg={checklistProgress === 100 ? "primary" : "primary"}
                          borderRadius="3px"
                          transition="width 0.3s ease"
                        />
                      </Box>
                    </Flex>
                  )}

                  {/* Checklist items */}
                  <VStack spacing={0} align="stretch">
                    {visibleChecklist.map((item) => (
                      <Flex
                        key={item.id}
                        role="group"
                        align="center"
                        gap={2.5}
                        py={1.5}
                        px={1}
                        mx={-1}
                        borderRadius="4px"
                        _hover={{ bg: "bg.hover" }}
                        transition="background 0.1s ease"
                      >
                        {/* Checklist item checkbox */}
                        <Box
                          as="button"
                          flexShrink={0}
                          w="16px"
                          h="16px"
                          borderRadius="3px"
                          border={item.checked ? "none" : "2px solid"}
                          borderColor="text.tertiary"
                          bg={item.checked ? "primary" : "transparent"}
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          _hover={{ borderColor: "primary" }}
                          transition="all 0.15s ease"
                          onClick={() => toggleChecklistItem(item.id)}
                        >
                          {item.checked && <Icon as={FiCheck} boxSize="10px" color="white" />}
                        </Box>

                        <Text
                          fontSize="sm"
                          color={item.checked ? "text.tertiary" : "text"}
                          textDecoration={item.checked ? "line-through" : "none"}
                          flex={1}
                        >
                          {item.text}
                        </Text>

                        <IconButton
                          icon={<FiX />}
                          size="xs"
                          variant="ghost"
                          color="text.tertiary"
                          _hover={{ color: "red.400" }}
                          aria-label="Delete item"
                          minW="20px"
                          h="20px"
                          opacity={0}
                          _groupHover={{ opacity: 1 }}
                          transition="opacity 0.15s ease"
                          onClick={() => deleteChecklistItem(item.id)}
                        />
                      </Flex>
                    ))}
                  </VStack>

                  {/* Add item */}
                  <HStack spacing={2} mt={2}>
                    <Input
                      value={newChecklistItem}
                      onChange={(e) => setNewChecklistItem(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addChecklistItem();
                        }
                      }}
                      placeholder="Add an item..."
                      size="sm"
                      variant="flushed"
                      fontSize="sm"
                      color="text"
                      _placeholder={{ color: "text.tertiary" }}
                      borderColor="border"
                      _focus={{ borderColor: "primary" }}
                    />
                    {newChecklistItem.trim() && (
                      <Button
                        size="xs"
                        bg="primary"
                        color="white"
                        _hover={{ bg: "#5a6656" }}
                        borderRadius="4px"
                        onClick={addChecklistItem}
                        flexShrink={0}
                      >
                        Add
                      </Button>
                    )}
                  </HStack>
                </Box>

                {/* Divider */}
                <Box h="1px" bg="border" my={5} />

                {/* Calendar link */}
                <HStack spacing={2} mb={3}>
                  {!activeTask.linkedEventId ? (
                    <Button
                      size="xs" variant="ghost" color="text.secondary"
                      leftIcon={<Icon as={FiCalendar} boxSize="12px" />}
                      fontWeight="400" fontSize="xs" borderRadius="6px"
                      border="1px solid" borderColor="border"
                      _hover={{ bg: "bg.hover" }}
                      onClick={() => {
                        createEventFromTodo(user.uid, activeTask).then((newEvent) => {
                          setTodos((prev) => prev.map((t) => t.id === activeTask.id ? { ...t, linkedEventId: newEvent.id } : t));
                        });
                      }}
                    >
                      Add to Calendar
                    </Button>
                  ) : (
                    <Button
                      size="xs" variant="ghost" color="primary"
                      leftIcon={<Icon as={FiCalendar} boxSize="12px" />}
                      fontWeight="500" fontSize="xs" borderRadius="6px"
                      _hover={{ bg: "bg.hover" }}
                      onClick={() => navigate("/calendar")}
                    >
                      View on Calendar
                    </Button>
                  )}
                </HStack>

                {/* Metadata footer */}
                <Flex align="center" justify="space-between" flexWrap="wrap" gap={2}>
                  <Text fontSize="xs" color="text.tertiary">
                    Created {formatFullDate(activeTask.createdAt)}
                    {activeTask.updatedAt !== activeTask.createdAt &&
                      ` · Updated ${formatFullDate(activeTask.updatedAt)}`}
                  </Text>
                  <Button
                    size="xs"
                    variant="ghost"
                    color="text.tertiary"
                    leftIcon={<Icon as={FiTrash2} boxSize="12px" />}
                    fontWeight="400"
                    fontSize="xs"
                    _hover={{ color: "red.400", bg: "bg.hover" }}
                    onClick={() => handleRequestDelete(activeTask)}
                  >
                    Delete task
                  </Button>
                </Flex>
              </>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* ========== CONTEXT MENU ========== */}
      {contextMenu && (
        <Box
          position="fixed" left={`${contextMenu.x}px`} top={`${contextMenu.y}px`}
          zIndex={9999} bg="background" border="1px solid" borderColor="border"
          borderRadius="8px" shadow="0 8px 24px rgba(0,0,0,0.15)" py={1} minW="120px"
          onClick={(e) => e.stopPropagation()}
        >
          <Box px={3} py={2} cursor="pointer" _hover={{ bg: "bg.hover" }} transition="background 0.1s" onClick={() => { handleOpenDetail(contextMenu.item); setContextMenu(null); }}>
            <Text fontSize="xs" color="text">Open</Text>
          </Box>
          <Box h="1px" bg="border" mx={2} />
          <Box px={3} py={2} cursor="pointer" _hover={{ bg: "bg.hover" }} transition="background 0.1s" onClick={() => { handleRequestDelete(contextMenu.item); setContextMenu(null); }}>
            <Text fontSize="xs" color="red.400">Delete</Text>
          </Box>
        </Box>
      )}

      {/* ========== DELETE DIALOG ========== */}
      <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelRef} onClose={onDeleteClose}>
        <AlertDialogOverlay>
          <AlertDialogContent borderRadius="12px" mx={4}>
            <AlertDialogHeader fontSize="lg" fontWeight="600" color="text">
              Delete Task
            </AlertDialogHeader>
            <AlertDialogBody color="text.secondary">
              Are you sure you want to delete &ldquo;{taskToDelete?.title || "Untitled"}&rdquo;? This
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
    </Box>
  );
};

export default ToDoPage;
