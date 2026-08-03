# registry.py
# The tool registry — the spine of the eval platform.
# It does two jobs from one place:
#   1. describe a tool to the model   (get_tool_schema)  -> name + description + args
#   2. run the tool the model picks   (execute_tool)     -> the stored function
#
# Concept this project teaches: a function is DATA. We store it now (uncalled)
# and run it later, on demand.


# --- 1. The registry -------------------------------------------------------
# key   = tool name (str)
# value = a bundle describing AND holding the tool (a dict).
TOOLS = {}


# --- 2. Put a tool on the shelf --------------------------------------------
# Note: `func` is stored as-is (no parentheses) -> the function itself, not its
# result. Nothing runs here; the tool just gets parked in TOOLS.
def register_tool(name, description, args_spec, func):
    TOOLS[name] = {
        "name": name,
        "description": description,
        "args_spec": args_spec,   # {arg_name: expected_type}
        "func": func,
    }


# --- 3. The menu for the model ---------------------------------------------
# Returns name + description + args ONLY. Never hands over `func`.
# Raises if the tool doesn't exist.
def get_tool_schema(name):
    if name not in TOOLS:
        raise KeyError(f"unknown tool: {name}")
    tool = TOOLS[name]
    return {
        "name": tool["name"],
        "description": tool["description"],
        "args_spec": tool["args_spec"],
    }


# --- 4. Run the tool the model picked --------------------------------------
# Look it up, validate the args (present + right type), then call the function.
def execute_tool(name, args):
    if name not in TOOLS:
        raise KeyError(f"unknown tool: {name}")
    tool = TOOLS[name]
    spec = tool["args_spec"]

    for arg_name, arg_type in spec.items():
        if arg_name not in args:
            raise ValueError(f"missing required arg: {arg_name}")
        if not isinstance(args[arg_name], arg_type):
            raise TypeError(f"arg {arg_name} must be {arg_type.__name__}")

    # ** unpacks the dict into keyword arguments: {"a": 2, "b": 3} -> add(a=2, b=3)
    return tool["func"](**args)


# --- quick test -------------------------------------------------------------
if __name__ == "__main__":
    def add(a, b):
        return a + b

    register_tool("add", "Add two numbers", {"a": int, "b": int}, add)

    print("registry :", TOOLS)                         # func stored as data
    print("schema   :", get_tool_schema("add"))        # menu, no func
    print("execute  :", execute_tool("add", {"a": 2, "b": 3}))  # -> 5
