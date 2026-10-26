export const QUICK_QUIZ_SUBJECTS = [
  { name: "DBMS", icon: "▤" },
  { name: "Operating Systems", icon: "⚙" },
  { name: "Java", icon: "☕" },
];

export const QUICK_QUIZZES = {
  DBMS: [
    {
      question: "What is the main purpose of a primary key?",
      options: [
        "Uniquely identify each row in a table",
        "Store a table's backup",
        "Sort rows alphabetically",
        "Connect to the database server",
      ],
      answer: 0,
      explanation: "A primary key uniquely identifies each row and cannot contain duplicate values.",
    },
    {
      question: "Which SQL command is used to retrieve rows from a table?",
      options: ["INSERT", "SELECT", "UPDATE", "DELETE"],
      answer: 1,
      explanation: "SELECT reads data from one or more database tables.",
    },
    {
      question: "Which ACID property means a transaction completes fully or not at all?",
      options: ["Consistency", "Isolation", "Durability", "Atomicity"],
      answer: 3,
      explanation: "Atomicity treats all operations in a transaction as one indivisible unit.",
    },
    {
      question: "What does a foreign key usually reference?",
      options: [
        "A column in another table, often its primary key",
        "The database password",
        "A stored procedure",
        "A table's row count",
      ],
      answer: 0,
      explanation: "A foreign key links related tables by referencing a key in another table.",
    },
    {
      question: "Which normal form removes partial dependency on a composite key?",
      options: ["First normal form", "Second normal form", "Third normal form", "Fourth normal form"],
      answer: 1,
      explanation: "Second normal form requires each non-key attribute to depend on the whole candidate key.",
    },
  ],
  "Operating Systems": [
    {
      question: "Which scheduling algorithm gives each process a fixed time slice?",
      options: ["First Come, First Served", "Shortest Job First", "Round Robin", "Priority only"],
      answer: 2,
      explanation: "Round Robin cycles through processes and gives each one a fixed time quantum.",
    },
    {
      question: "What is a deadlock?",
      options: [
        "A process finishes before its time slice ends",
        "Processes wait indefinitely for resources held by one another",
        "The CPU changes from user mode to kernel mode",
        "A program releases all its memory",
      ],
      answer: 1,
      explanation: "In a deadlock, processes are stuck waiting for resources that other waiting processes hold.",
    },
    {
      question: "What happens during a context switch?",
      options: [
        "The operating system saves one process state and loads another",
        "A file is copied to a new folder",
        "The computer shuts down",
        "A program is translated into source code",
      ],
      answer: 0,
      explanation: "A context switch saves the current execution state so another process or thread can run.",
    },
    {
      question: "What does virtual memory provide to a process?",
      options: [
        "A larger logical address space than physical RAM alone",
        "A faster physical processor",
        "A permanent copy of every file",
        "A second keyboard",
      ],
      answer: 0,
      explanation: "Virtual memory maps a process's address space to physical memory and may use disk-backed pages.",
    },
    {
      question: "Which synchronization tool commonly uses wait and signal operations?",
      options: ["Compiler", "Semaphore", "File descriptor", "Scheduler queue"],
      answer: 1,
      explanation: "Semaphores coordinate access to shared resources using wait and signal operations.",
    },
  ],
  Java: [
    {
      question: "Which keyword declares that a Java class inherits from another class?",
      options: ["implements", "extends", "inherits", "super"],
      answer: 1,
      explanation: "A Java class uses extends to inherit from another class.",
    },
    {
      question: "What does the Java compiler produce from source code?",
      options: ["Bytecode", "Machine-specific firmware", "HTML", "A database table"],
      answer: 0,
      explanation: "The Java compiler produces bytecode, which the Java Virtual Machine can execute.",
    },
    {
      question: "Which Java type stores a true-or-false value?",
      options: ["int", "char", "boolean", "double"],
      answer: 2,
      explanation: "The primitive boolean type stores either true or false.",
    },
    {
      question: "What is true about Java String objects?",
      options: [
        "They are immutable",
        "They can only contain digits",
        "They are always stored as numbers",
        "They cannot be compared",
      ],
      answer: 0,
      explanation: "String objects are immutable; operations that appear to change one create another String.",
    },
    {
      question: "Which access modifier allows a class member to be accessed from any package?",
      options: ["private", "protected", "package-private", "public"],
      answer: 3,
      explanation: "A public member is accessible from any class that can access its containing type.",
    },
  ],
};
