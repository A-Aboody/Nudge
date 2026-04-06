import {
  Box,
  Flex,
  VStack,
  FormControl,
  FormLabel,
  Input,
  Select,
  Button,
  useToast,
  Heading,
  Textarea,
} from "@chakra-ui/react";
import { FiPlus } from "react-icons/fi";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const AddBillPage = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [formData, setFormData] = useState({
    name: "",
    amount: "",
    dueDate: "",
    category: "",
    frequency: "monthly",
    notes: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Form submitted:", formData);

    toast({
      title: "Bill added successfully",
      status: "success",
      duration: 3000,
      isClosable: true,
    });

    navigate("/calendar");
  };

  return (
    <Box maxW="md" mx="auto" p={{ base: 6, md: 10 }}>
      <Flex mb={6} alignItems="center">
        <Heading size="lg" ml={4} color="text" fontWeight="700" letterSpacing="-0.01em">
          Add New Bill
        </Heading>
      </Flex>

      <form onSubmit={handleSubmit}>
        <VStack spacing={6}>
          <FormControl isRequired>
            <FormLabel color="text.secondary" fontSize="sm" fontWeight="500">
              Bill Name
            </FormLabel>
            <Input
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. Electricity Bill"
            />
          </FormControl>

          <FormControl isRequired>
            <FormLabel color="text.secondary" fontSize="sm" fontWeight="500">
              Amount
            </FormLabel>
            <Input
              name="amount"
              type="number"
              value={formData.amount}
              onChange={handleChange}
              placeholder="0.00"
            />
          </FormControl>

          <FormControl isRequired>
            <FormLabel color="text.secondary" fontSize="sm" fontWeight="500">
              Due Date
            </FormLabel>
            <Input
              name="dueDate"
              type="date"
              value={formData.dueDate}
              onChange={handleChange}
            />
          </FormControl>

          <FormControl isRequired>
            <FormLabel color="text.secondary" fontSize="sm" fontWeight="500">
              Category
            </FormLabel>
            <Select
              name="category"
              value={formData.category}
              onChange={handleChange}
              placeholder="Select category"
            >
              <option value="housing">Housing</option>
              <option value="utilities">Utilities</option>
              <option value="transportation">Transportation</option>
              <option value="food">Food</option>
              <option value="healthcare">Healthcare</option>
              <option value="insurance">Insurance</option>
              <option value="debt">Debt Payments</option>
              <option value="entertainment">Entertainment</option>
              <option value="other">Other</option>
            </Select>
          </FormControl>

          <FormControl>
            <FormLabel color="text.secondary" fontSize="sm" fontWeight="500">
              Frequency
            </FormLabel>
            <Select
              name="frequency"
              value={formData.frequency}
              onChange={handleChange}
            >
              <option value="one-time">One-time</option>
              <option value="weekly">Weekly</option>
              <option value="bi-weekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </Select>
          </FormControl>

          <FormControl>
            <FormLabel color="text.secondary" fontSize="sm" fontWeight="500">
              Notes
            </FormLabel>
            <Textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Any additional notes about this bill"
              rows={3}
            />
          </FormControl>

          <Button
            type="submit"
            leftIcon={<FiPlus />}
            bg="primary"
            color="white"
            _hover={{ bg: "#5a6656" }}
            width="full"
            mt={4}
            fontWeight="500"
            borderRadius="6px"
          >
            Add Bill
          </Button>
        </VStack>
      </form>
    </Box>
  );
};

export default AddBillPage;
