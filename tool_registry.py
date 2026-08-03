# tool_registry.py
# A minimal tool registry — the pattern under every "function calling" system.

# --- Step 1: the registry ---------------------------------------------------
# Key   = tool name (str)
# Value = everything needed to describe AND run the tool (a dict).
TOOLS = {}


# --- Step 2: register a tool ------------------------------------------------
# The value is a dict-inside-a-dict holding all four things.
# Notice: `func` is stored as DATA. There is no add() call here — we bind the
# function object itself. Nothing runs until execute_tool asks it to.
def register_tool(name, description, args_spec, func):
    TOOLS[name] = {
        "name": name,
        "description": description,
        "args_spec": args_spec,   # {arg_name: expected_type}
        "func": func,
    }


# --- Step 3: schema for the model -------------------------------------------
# Returns description + arg spec, NEVER the function. Raises if unknown.
def get_tool_schema(name):
    if name not in TOOLS:
        raise KeyError(f"unknown tool: {name!r}")
    tool = TOOLS[name]
    return {
        "name": tool["name"],
        "description": tool["description"],
        "args_spec": tool["args_spec"],
    }


# --- Step 4: execute a tool -------------------------------------------------
# Look it up, validate name / required args / types, then call it.
def execute_tool(name, args):
    if name not in TOOLS:
        raise KeyError(f"unknown tool: {name!r}")
    tool = TOOLS[name]
    spec = tool["args_spec"]

    for arg_name, arg_type in spec.items():
        if arg_name not in args:
            raise ValueError(f"missing required arg: {arg_name!r}")
        if not isinstance(args[arg_name], arg_type):
            raise TypeError(
                f"arg {arg_name!r} must be {arg_type.__name__}, "
                f"got {type(args[arg_name]).__name__}"
            )

    # The one operator: ** unpacks the dict into keyword arguments,
    # so {"a": 2, "b": 3} becomes func(a=2, b=3).
    return tool["func"](**args)


if __name__ == "__main__":
    def add(a, b):
        return a + b

    register_tool("add", "Add two integers", {"a": int, "b": int}, add)

    print("TOOLS       ->", TOOLS)
    print("schema      ->", get_tool_schema("add"))
    print("execute     ->", execute_tool("add", {"a": 2, "b": 3}))
